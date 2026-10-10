// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @notice Mock 6-decimal ERC-20 token simulating Arc's native USDC ERC-20 precompile.
 */
contract MockUSDC is ERC20 {
    uint8 private constant _DECIMALS = 6;
    bool public shouldFailTransfer;
    bool public shouldFailTransferFrom;

    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setFailTransfer(bool fail) external {
        shouldFailTransfer = fail;
    }

    function setFailTransferFrom(bool fail) external {
        shouldFailTransferFrom = fail;
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        if (shouldFailTransfer) {
            return false;
        }
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        if (shouldFailTransferFrom) {
            return false;
        }
        return super.transferFrom(from, to, amount);
    }
}
