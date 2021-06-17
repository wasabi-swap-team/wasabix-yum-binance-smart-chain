// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "hardhat/console.sol";

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {FixedPointMath} from "../libraries/FixedPointMath.sol";
import {IDetailedERC20} from "../interfaces/IDetailedERC20.sol";
import {IVaultAdapterV2} from "../interfaces/IVaultAdapterV2.sol";
import {IbBUSDToken} from "../interfaces/alpaca/IbBUSDToken.sol";
import {IAlpacaPool} from "../interfaces/alpaca/IAlpacaPool.sol";
import {IUniswapV2Router02} from "../libraries/uni/IUniswapV2Router02.sol";

/// @title AlpacaVaultAdapter
///
/// @dev A vault adapter implementation which wraps a alpaca vault.
contract AlpacaVaultAdapter is IVaultAdapterV2 {
  using FixedPointMath for FixedPointMath.uq192x64;
  using SafeERC20 for IDetailedERC20;
  using SafeMath for uint256;

  /// @dev The vault that the adapter is wrapping.
  IbBUSDToken public vault;

  /// @dev The stakingPool that the adapter is wrapping.
  IAlpacaPool public stakingPool;

  /// @dev UniswapV2Router
  IUniswapV2Router02 public uniV2Router;

  /// @dev alpacaToken
  IDetailedERC20 public alpacaToken;

  /// @dev wBNB
  IDetailedERC20 public wBNBToken;

  /// @dev The address which has admin control over this contract.
  address public admin;

  /// @dev The decimals of the token.
  uint256 public decimals;

  constructor(IbBUSDToken _vault, address _admin, IUniswapV2Router02 _uniV2Router, IAlpacaPool _stakingPool, IDetailedERC20 _alpacaToken, IDetailedERC20 _wBNBToken) public {
    require(address(_vault) != address(0), "AlpacaVaultAdapter: vault address cannot be 0x0.");
    require(_admin != address(0), "AlpacaVaultAdapter: _admin cannot be 0x0.");

    vault = _vault;
    admin = _admin;
    uniV2Router = _uniV2Router;
    stakingPool = _stakingPool;
    alpacaToken = _alpacaToken;
    wBNBToken = _wBNBToken;

    updateApproval();
    decimals = _vault.decimals();
  }

  /// @dev A modifier which reverts if the caller is not the admin.
  modifier onlyAdmin() {
    require(admin == msg.sender, "AlpacaVaultAdapter: only admin");
    _;
  }

  /// @dev Gets the token that the vault accepts.
  ///
  /// @return the accepted token.
  function token() external view override returns (IDetailedERC20) {
    return IDetailedERC20(vault.token());
  }

  /// @dev Gets the total value of the assets that the adapter holds in the vault.
  ///
  /// @return the total assets.
  function totalValue() external view override returns (uint256) {

    (uint256 amount,,,) = stakingPool.userInfo(3,address(this));
    return _sharesToTokens(amount);
  }

  /// @dev Deposits tokens into the vault.
  ///
  /// @param _amount the amount of tokens to deposit into the vault.
  function deposit(uint256 _amount) external override {

    // deposit to vault
    vault.deposit(_amount);
    // stake to pool
    stakingPool.deposit(address(this),3,vault.balanceOf(address(this)));

  }

  /// @dev Withdraws tokens from the vault to the recipient.
  ///
  /// This function reverts if the caller is not the admin.
  ///
  /// @param _recipient the account to withdraw the tokes to.
  /// @param _amount    the amount of tokens to withdraw.
  function withdraw(address _recipient, uint256 _amount, bool _isHarvest) external override onlyAdmin {
    // unstake
    stakingPool.withdraw(address(this),3,_tokensToShares(_amount));

    // withdraw
    vault.withdraw(_tokensToShares(_amount));

    IDetailedERC20 busdToken = IDetailedERC20(vault.token());

    // sell alpaca if is called from harvest
    if(_isHarvest){

      // withdraw accumulated ibusd from collector harvest
      if(vault.balanceOf(address(this)) > 0){
        vault.withdraw(vault.balanceOf(address(this)));
      }

      stakingPool.harvest(3);

      address[] memory _pathAlpaca = new address[](3);
      _pathAlpaca[0] = address(alpacaToken);
      _pathAlpaca[1] = address(wBNBToken);
      _pathAlpaca[2] = address(busdToken);

      uniV2Router.swapExactTokensForTokens(alpacaToken.balanceOf(address(this)),
                                           0,
                                           _pathAlpaca,
                                           address(this),
                                           block.timestamp+800);
    }

    // transfer all the busd in adapter to yum
    busdToken.transfer(_recipient,busdToken.balanceOf(address(this)));
  }

  /// @dev Updates the vaults approval of the token to be the maximum value.
  function updateApproval() public {
    // busd to vault
    address _token = vault.token();
    IDetailedERC20(_token).safeApprove(address(vault), uint256(-1));
    // vault to stakingPool
    IDetailedERC20(address(vault)).safeApprove(address(stakingPool), uint256(-1));
    // alpaca to swapRouter
    alpacaToken.safeApprove(address(uniV2Router), uint256(-1));
  }

  /// @dev Computes the number of tokens an amount of shares is worth.
  ///
  /// @param _sharesAmount the amount of shares.
  ///
  /// @return the number of tokens the shares are worth.

  function _sharesToTokens(uint256 _sharesAmount) internal view returns (uint256) {
    return _sharesAmount.mul(vault.totalToken()).div(vault.totalSupply());
  }

  /// @dev Computes the number of shares an amount of tokens is worth.
  ///
  /// @param _tokensAmount the amount of shares.
  ///
  /// @return the number of shares the tokens are worth.
  function _tokensToShares(uint256 _tokensAmount) internal view returns (uint256) {
    return _tokensAmount.mul(vault.totalSupply()).div(vault.totalToken());
  }
}
