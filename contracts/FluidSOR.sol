// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IFluidStableAMM {
    function getAmountOut(uint256 i, uint256 j, uint256 dx) external view returns (uint256 dy, uint256 fee);
    function swap(uint256 i, uint256 j, uint256 dx, uint256 minDy, address to, uint256 deadline) external returns (uint256 dy);
    function token0() external view returns (address);
    function token1() external view returns (address);
}

interface IUniswapV3Router {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external returns (uint256 amountOut);
}

interface IAerodromeRouter {
    struct Route {
        address from;
        address to;
        bool stable;
        address factory;
    }
    function getAmountsOut(uint256 amountIn, Route[] memory routes) external view returns (uint256[] memory amounts);
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        Route[] calldata routes,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

/**
 * @title  FluidSOR — Smart Order Router
 * @author Fluid Wallet (fluidnative.com)
 * @notice Routes token swaps through the best available liquidity venue on Base:
 *         the Fluid Stable AMM, Uniswap V3, or Aerodrome. Supports single-venue
 *         and split routing across two venues simultaneously.
 *
 * @dev    Deploy instructions:
 *           forge create contracts/FluidSOR.sol:FluidSOR \
 *             --constructor-args <FLUID_POOL_ADDRESS> \
 *             --rpc-url base --broadcast --verify
 *
 *         Off-chain routing decisions (best venue selection) are made by the
 *         Fluid SOR backend (`/api/sor/quote`) and the `@fluidbase/sdk`.
 *         This contract is the execution layer — it trusts the caller to pass
 *         the correct route parameters obtained from an off-chain quote.
 *
 *         Users must `approve` this contract to spend their input token before
 *         calling any swap function.
 */
contract FluidSOR {

    // ─── Version ─────────────────────────────────────────────────────────────

    string public constant VERSION = "1.0.0";

    // ─── Base Mainnet Addresses ───────────────────────────────────────────────

    /// @notice Wrapped ETH on Base
    address public constant WETH   = 0x4200000000000000000000000000000000000006;
    /// @notice USDC on Base (Circle)
    address public constant USDC   = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    /// @notice USDT on Base (Tether)
    address public constant USDT   = 0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2;
    /// @notice Uniswap V3 SwapRouter02 on Base
    address public constant UNIV3_ROUTER      = 0x2626664c2603336E57B271c5C0b26F421741e481;
    /// @notice Aerodrome Finance Router on Base
    address public constant AERODROME_ROUTER  = 0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43;
    /// @notice Aerodrome default pool factory
    address public constant AERODROME_FACTORY = 0x420DD381b31aEf6683db6B902084cB0FFECe40Da;

    // ─── State ────────────────────────────────────────────────────────────────

    /// @notice Fluid Stable AMM pool address (USDC / USDT). Updatable by owner.
    address public fluidPool;
    /// @notice Contract administrator
    address public owner;

    // ─── Types ────────────────────────────────────────────────────────────────

    /// @notice Identifies which liquidity venue executes the swap.
    enum Venue {
        FLUID_AMM,         // Fluid Stable AMM  — optimised for pegged pairs
        UNISWAP_V3_100,    // Uniswap V3 0.01 % pool
        UNISWAP_V3_500,    // Uniswap V3 0.05 % pool
        UNISWAP_V3_3000,   // Uniswap V3 0.30 % pool
        AERODROME_STABLE,  // Aerodrome stable curve pool
        AERODROME_VOLATILE // Aerodrome volatile (xy=k) pool
    }

    // ─── Events ───────────────────────────────────────────────────────────────

    event Swap(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        Venue venue
    );

    event SplitSwap(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        Venue venueA,
        Venue venueB,
        uint256 splitBps  // portion (in bps) sent to venueA
    );

    event FluidPoolUpdated(address indexed oldPool, address indexed newPool);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error Expired();
    error NotOwner();
    error ZeroAddress();
    error NoFluidPool();
    error UnsupportedPair();
    error SlippageExceeded(uint256 received, uint256 minimum);
    error InvalidSplit();
    error TransferFailed();

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier notExpired(uint256 deadline) {
        if (block.timestamp > deadline) revert Expired();
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────

    /**
     * @param _fluidPool Address of the deployed Fluid Stable AMM pool.
     *                   Pass address(0) if the pool is not yet deployed.
     */
    constructor(address _fluidPool) {
        owner    = msg.sender;
        fluidPool = _fluidPool;
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    /// @notice Update the Fluid pool address after deployment.
    function setFluidPool(address _pool) external onlyOwner {
        emit FluidPoolUpdated(fluidPool, _pool);
        fluidPool = _pool;
    }

    /// @notice Transfer contract ownership.
    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, _newOwner);
        owner = _newOwner;
    }

    // ─── View: Quotes ─────────────────────────────────────────────────────────

    /**
     * @notice On-chain quote from the Fluid Stable AMM.
     * @dev    Returns 0 if the pair is not USDC/USDT or the pool is unset.
     *         Safe to call via eth_call from the frontend without gas cost.
     */
    function getFluidQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut) {
        if (fluidPool == address(0)) return 0;

        address t0 = IFluidStableAMM(fluidPool).token0();
        address t1 = IFluidStableAMM(fluidPool).token1();

        uint256 i;
        uint256 j;
        if (tokenIn == t0 && tokenOut == t1) {
            i = 0; j = 1;
        } else if (tokenIn == t1 && tokenOut == t0) {
            i = 1; j = 0;
        } else {
            return 0;
        }

        try IFluidStableAMM(fluidPool).getAmountOut(i, j, amountIn) returns (uint256 dy, uint256) {
            return dy;
        } catch {
            return 0;
        }
    }

    /**
     * @notice On-chain quote from Aerodrome Finance.
     * @param stable True for the stable-curve pool, false for the volatile pool.
     */
    function getAerodromeQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        bool stable
    ) external view returns (uint256 amountOut) {
        IAerodromeRouter.Route[] memory routes = new IAerodromeRouter.Route[](1);
        routes[0] = IAerodromeRouter.Route({
            from:    tokenIn,
            to:      tokenOut,
            stable:  stable,
            factory: AERODROME_FACTORY
        });
        try IAerodromeRouter(AERODROME_ROUTER).getAmountsOut(amountIn, routes) returns (uint256[] memory amounts) {
            return amounts[amounts.length - 1];
        } catch {
            return 0;
        }
    }

    // ─── Execute: Single-Venue Swaps ─────────────────────────────────────────

    /**
     * @notice Swap through the Fluid Stable AMM (USDC ↔ USDT only).
     * @dev    Requires `approve(sorAddress, amountIn)` on `tokenIn` beforehand.
     */
    function swapViaFluid(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        uint256 deadline
    ) external notExpired(deadline) returns (uint256 amountOut) {
        if (fluidPool == address(0)) revert NoFluidPool();

        address t0 = IFluidStableAMM(fluidPool).token0();
        address t1 = IFluidStableAMM(fluidPool).token1();

        uint256 i;
        uint256 j;
        if      (tokenIn == t0 && tokenOut == t1) { i = 0; j = 1; }
        else if (tokenIn == t1 && tokenOut == t0) { i = 1; j = 0; }
        else    revert UnsupportedPair();

        _pullAndApprove(tokenIn, amountIn, fluidPool);

        amountOut = IFluidStableAMM(fluidPool).swap(i, j, amountIn, minAmountOut, recipient, deadline);

        emit Swap(msg.sender, tokenIn, tokenOut, amountIn, amountOut, Venue.FLUID_AMM);
    }

    /**
     * @notice Swap through Uniswap V3.
     * @param fee The pool fee tier: 100, 500, 3000, or 10000.
     */
    function swapViaUniV3(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint24  fee,
        uint256 minAmountOut,
        address recipient,
        uint256 deadline
    ) external notExpired(deadline) returns (uint256 amountOut) {
        _pullAndApprove(tokenIn, amountIn, UNIV3_ROUTER);

        amountOut = IUniswapV3Router(UNIV3_ROUTER).exactInputSingle(
            IUniswapV3Router.ExactInputSingleParams({
                tokenIn:           tokenIn,
                tokenOut:          tokenOut,
                fee:               fee,
                recipient:         recipient,
                amountIn:          amountIn,
                amountOutMinimum:  minAmountOut,
                sqrtPriceLimitX96: 0
            })
        );

        Venue v;
        if      (fee == 100)  v = Venue.UNISWAP_V3_100;
        else if (fee == 500)  v = Venue.UNISWAP_V3_500;
        else                  v = Venue.UNISWAP_V3_3000;

        emit Swap(msg.sender, tokenIn, tokenOut, amountIn, amountOut, v);
    }

    /**
     * @notice Swap through Aerodrome Finance.
     * @param stable True for stable pool (pegged assets), false for volatile.
     */
    function swapViaAerodrome(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        bool    stable,
        uint256 minAmountOut,
        address recipient,
        uint256 deadline
    ) external notExpired(deadline) returns (uint256 amountOut) {
        _pullAndApprove(tokenIn, amountIn, AERODROME_ROUTER);

        IAerodromeRouter.Route[] memory routes = new IAerodromeRouter.Route[](1);
        routes[0] = IAerodromeRouter.Route({
            from:    tokenIn,
            to:      tokenOut,
            stable:  stable,
            factory: AERODROME_FACTORY
        });

        uint256[] memory amounts = IAerodromeRouter(AERODROME_ROUTER).swapExactTokensForTokens(
            amountIn, minAmountOut, routes, recipient, deadline
        );
        amountOut = amounts[amounts.length - 1];

        emit Swap(msg.sender, tokenIn, tokenOut, amountIn, amountOut,
                  stable ? Venue.AERODROME_STABLE : Venue.AERODROME_VOLATILE);
    }

    // ─── Execute: Split Routing ───────────────────────────────────────────────

    /**
     * @notice Split a swap between the Fluid AMM and Uniswap V3.
     *
     * @param splitBps Basis points (0–10000) allocated to the Fluid AMM.
     *                 The remainder goes through Uniswap V3.
     *                 Example: 6000 → 60 % Fluid, 40 % Uniswap V3.
     * @param uniV3Fee Uniswap V3 pool fee tier for the non-Fluid leg.
     *
     * @dev  The combined `minAmountOut` slippage guard covers the total output.
     *       Per-leg minimums are set to 0 to allow the split; the aggregate
     *       guard ensures the user cannot receive less than expected overall.
     */
    function splitSwapFluidUniV3(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 splitBps,
        uint24  uniV3Fee,
        uint256 minAmountOut,
        address recipient,
        uint256 deadline
    ) external notExpired(deadline) returns (uint256 totalOut) {
        if (splitBps > 10_000) revert InvalidSplit();
        if (fluidPool == address(0)) revert NoFluidPool();

        // Pull all tokens from sender once
        if (!IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn)) revert TransferFailed();

        uint256 fluidIn = (amountIn * splitBps) / 10_000;
        uint256 uniIn   = amountIn - fluidIn;

        // ── Fluid leg ────────────────────────────────────────────────────────
        uint256 fluidOut;
        if (fluidIn > 0) {
            address t0 = IFluidStableAMM(fluidPool).token0();
            uint256 i  = (tokenIn == t0) ? 0 : 1;

            if (!IERC20(tokenIn).approve(fluidPool, fluidIn)) revert TransferFailed();
            fluidOut = IFluidStableAMM(fluidPool).swap(i, 1 - i, fluidIn, 0, recipient, deadline);
        }

        // ── Uniswap V3 leg ───────────────────────────────────────────────────
        uint256 uniOut;
        if (uniIn > 0) {
            if (!IERC20(tokenIn).approve(UNIV3_ROUTER, uniIn)) revert TransferFailed();
            uniOut = IUniswapV3Router(UNIV3_ROUTER).exactInputSingle(
                IUniswapV3Router.ExactInputSingleParams({
                    tokenIn:           tokenIn,
                    tokenOut:          tokenOut,
                    fee:               uniV3Fee,
                    recipient:         recipient,
                    amountIn:          uniIn,
                    amountOutMinimum:  0,
                    sqrtPriceLimitX96: 0
                })
            );
        }

        totalOut = fluidOut + uniOut;
        if (totalOut < minAmountOut) revert SlippageExceeded(totalOut, minAmountOut);

        Venue uniVenue = (uniV3Fee == 100)  ? Venue.UNISWAP_V3_100
                       : (uniV3Fee == 500)  ? Venue.UNISWAP_V3_500
                       :                      Venue.UNISWAP_V3_3000;

        emit SplitSwap(msg.sender, tokenIn, tokenOut, amountIn, totalOut,
                       Venue.FLUID_AMM, uniVenue, splitBps);
    }

    /**
     * @notice Split a swap between the Fluid AMM and Aerodrome.
     *
     * @param splitBps Basis points (0–10000) allocated to the Fluid AMM.
     * @param stable   Whether to use Aerodrome's stable or volatile pool.
     */
    function splitSwapFluidAerodrome(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 splitBps,
        bool    stable,
        uint256 minAmountOut,
        address recipient,
        uint256 deadline
    ) external notExpired(deadline) returns (uint256 totalOut) {
        if (splitBps > 10_000) revert InvalidSplit();
        if (fluidPool == address(0)) revert NoFluidPool();

        if (!IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn)) revert TransferFailed();

        uint256 fluidIn  = (amountIn * splitBps) / 10_000;
        uint256 aeroIn   = amountIn - fluidIn;

        // ── Fluid leg ────────────────────────────────────────────────────────
        uint256 fluidOut;
        if (fluidIn > 0) {
            address t0 = IFluidStableAMM(fluidPool).token0();
            uint256 i  = (tokenIn == t0) ? 0 : 1;

            if (!IERC20(tokenIn).approve(fluidPool, fluidIn)) revert TransferFailed();
            fluidOut = IFluidStableAMM(fluidPool).swap(i, 1 - i, fluidIn, 0, recipient, deadline);
        }

        // ── Aerodrome leg ────────────────────────────────────────────────────
        uint256 aeroOut;
        if (aeroIn > 0) {
            if (!IERC20(tokenIn).approve(AERODROME_ROUTER, aeroIn)) revert TransferFailed();

            IAerodromeRouter.Route[] memory routes = new IAerodromeRouter.Route[](1);
            routes[0] = IAerodromeRouter.Route({
                from:    tokenIn,
                to:      tokenOut,
                stable:  stable,
                factory: AERODROME_FACTORY
            });

            uint256[] memory amounts = IAerodromeRouter(AERODROME_ROUTER).swapExactTokensForTokens(
                aeroIn, 0, routes, recipient, deadline
            );
            aeroOut = amounts[amounts.length - 1];
        }

        totalOut = fluidOut + aeroOut;
        if (totalOut < minAmountOut) revert SlippageExceeded(totalOut, minAmountOut);

        emit SplitSwap(msg.sender, tokenIn, tokenOut, amountIn, totalOut,
                       Venue.FLUID_AMM,
                       stable ? Venue.AERODROME_STABLE : Venue.AERODROME_VOLATILE,
                       splitBps);
    }

    // ─── Internal Helpers ─────────────────────────────────────────────────────

    /// @dev Pull `amount` of `token` from msg.sender and approve `spender`.
    function _pullAndApprove(address token, uint256 amount, address spender) internal {
        if (!IERC20(token).transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        if (!IERC20(token).approve(spender, amount)) revert TransferFailed();
    }
}
