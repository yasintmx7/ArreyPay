// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
// Local test fixture only. NEVER used for Arc settlement.
contract MockUSDC {
    mapping(address=>uint256) public balanceOf;
    mapping(address=>mapping(address=>uint256)) public allowance;
    address public blocked;
    function decimals() external pure returns(uint8){return 6;}
    function mint(address to,uint256 amount) external {balanceOf[to]+=amount;}
    function blockAddress(address a) external {blocked=a;}
    function approve(address spender,uint256 amount) external returns(bool){allowance[msg.sender][spender]=amount;return true;}
    function transfer(address to,uint256 amount) external returns(bool){require(to!=blocked,"blocked");balanceOf[msg.sender]-=amount;balanceOf[to]+=amount;return true;}
    function transferFrom(address from,address to,uint256 amount) external returns(bool){require(to!=blocked&&from!=blocked,"blocked");allowance[from][msg.sender]-=amount;balanceOf[from]-=amount;balanceOf[to]+=amount;return true;}
}
