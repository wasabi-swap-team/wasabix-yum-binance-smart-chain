// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "hardhat/console.sol";

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IDetailedERC20} from "../interfaces/IDetailedERC20.sol";
import {IVaultAdapterV2} from "../interfaces/IVaultAdapterV2.sol";
import {IbBUSDToken} from "../interfaces/alpaca/IbBUSDToken.sol";
import {IAlpacaPool} from "../interfaces/alpaca/IAlpacaPool.sol";
import {IUniswapV2Router02} from "../libraries/uni/IUniswapV2Router02.sol";
import {AlpacaVaultAdapter} from "./AlpacaVaultAdapter.sol";

/// @title AlpacaVaultAdapterWithIndirection
///
/// @dev A vault adapter implementation which wraps a vesper vault.
contract AlpacaVaultAdapterWithIndirection is AlpacaVaultAdapter {
  using SafeERC20 for IDetailedERC20;
  using SafeMath for uint256;

  constructor(IbBUSDToken _vault, address _admin, IUniswapV2Router02 _uniV2Router, IAlpacaPool _stakingPool, IDetailedERC20 _alpacaToken, IDetailedERC20 _wBNBToken)
              AlpacaVaultAdapter(_vault,_admin,_uniV2Router,_stakingPool,_alpacaToken,_wBNBToken) public {
  }

  /// @dev Sends vault tokens and alpaca token to the recipient
  ///
  /// This function reverts if the caller is not the admin.
  ///
  /// @param _recipient the account to send the tokens to.
  /// @param _amount    the amount of tokens to send.
  function indirectWithdraw(address _recipient, uint256 _amount) external onlyAdmin {
      // unstake ibBUSD
      stakingPool.withdraw(address(this),3,_tokensToShares(_amount));
      // transfer ibBUSD to recipient
      vault.transfer(_recipient, _tokensToShares(_amount));
      // claim alpaca token from staking pool
      stakingPool.harvest(3);
      // transfer alpaca to recipient
      alpacaToken.transfer(_recipient, alpacaToken.balanceOf(address(this)));
  }
}
