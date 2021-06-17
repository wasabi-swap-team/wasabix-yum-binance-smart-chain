// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.6.12;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../interfaces/IVaultAdapterV2.sol";

contract VaultAdapterV2Mock is IVaultAdapterV2 {
  using SafeERC20 for IDetailedERC20;

  IDetailedERC20 private _token;

  constructor(IDetailedERC20 token_) public {
    _token = token_;
  }

  function token() external view override returns (IDetailedERC20) {
    return _token;
  }

  function totalValue() external view override returns (uint256) {
    return _token.balanceOf(address(this));
  }

  function deposit(uint256 _amount) external override { }

  function withdraw(address _recipient, uint256 _amount, bool _isHarvest) external override {
    _token.safeTransfer(_recipient, _amount);
  }
}