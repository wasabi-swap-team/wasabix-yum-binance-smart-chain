// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.6.12;

import "../interfaces/IBUSDVaultAdapterV2WithIndirection.sol";
import "../interfaces/IDetailedERC20.sol";

contract TransmuterV2AdapterWithIndirectionMock is IBUSDVaultAdapterV2WithIndirection {

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
    _token.transfer(_recipient, _amount);
  }

  function indirectWithdraw(address _recipient, uint256 _amount) external override {
    _token.transfer(_recipient, _amount);
  }
}
