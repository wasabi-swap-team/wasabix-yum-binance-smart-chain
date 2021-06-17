// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IbBUSDToken is IERC20 {
    function deposit(uint256) external;

    function withdraw(uint256) external;

    function token() external view returns (address);

    function vaultDebtShare() external view returns (uint256);

    function vaultDebtVal() external view returns (uint256);

    function debtShareToVal(uint256) external view returns (uint256);

    function decimals() external view returns (uint);

    function totalToken() external view returns (uint256);

}
