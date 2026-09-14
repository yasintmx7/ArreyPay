// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @notice Arc TESTNET only. Amounts use the native USDC ERC-20 interface (6 decimals).
/// @dev No admin withdrawals, fees, upgrades, or arbitrary external calls.
contract ArreyCheckout {
    IERC20 public constant USDC = IERC20(0x3600000000000000000000000000000000000000);
    uint256 public constant VERSION = 1;
    uint256 public nextId = 1;
    uint256 private entered = 1;
    struct Bill {
        address merchant;
        uint128 target;
        uint128 raised;
        uint64 deadline;
        uint16 people;
        bool settled;
        bool cancelled;
        string title;
        string merchantName;
    }
    mapping(uint256 => Bill) private bills;
    mapping(uint256 => mapping(address => uint256)) public contribution;
    mapping(uint256 => mapping(address => uint256)) public refunded;
    mapping(uint256 => address[]) private contributors;
    mapping(address => uint256[]) private walletBills;
    mapping(address => mapping(uint256 => bool)) private linked;
    event Created(uint256 indexed id, address indexed merchant, uint256 target, uint64 deadline);
    event Contributed(uint256 indexed id, address indexed payer, uint256 amount);
    event Settled(uint256 indexed id, address indexed merchant, uint256 amount);
    event Cancelled(uint256 indexed id);
    event Refunded(uint256 indexed id, address indexed payer, uint256 amount);
    error InvalidBill(); error InvalidAmount(); error Closed(); error Unauthorized(); error TransferFailed(); error Reentrant();
    modifier nonReentrant() { if(entered != 1) revert Reentrant(); entered = 2; _; entered = 1; }
    constructor() { require(block.chainid == 5042002, "Arc testnet only"); }
    function create(string calldata title, string calldata merchantName, uint128 target, uint64 deadline, uint16 people) external returns(uint256 id) {
        if(bytes(title).length == 0 || bytes(title).length > 120 || bytes(merchantName).length == 0 || bytes(merchantName).length > 120 || target == 0 || target > 1000000e6 || deadline <= block.timestamp || deadline > block.timestamp + 30 days || people == 0 || people > 100) revert InvalidBill();
        id = nextId++;
        bills[id] = Bill(msg.sender,target,0,deadline,people,false,false,title,merchantName);
        _link(msg.sender,id);
        emit Created(id,msg.sender,target,deadline);
    }
    function getBill(uint256 id) external view returns(Bill memory) { if(bills[id].merchant == address(0)) revert InvalidBill(); return bills[id]; }
    function getWalletBills(address wallet, uint256 offset, uint256 limit) external view returns(uint256[] memory ids, uint256 total) {
        total = walletBills[wallet].length;
        if(offset >= total) return(new uint256[](0),total);
        if(limit > 100) limit = 100;
        uint256 count = total-offset; if(count > limit) count=limit;
        ids = new uint256[](count);
        for(uint256 i; i<count; ++i) ids[i] = walletBills[wallet][total-1-offset-i];
    }
    function getContributors(uint256 id,uint256 offset,uint256 limit) external view returns(address[] memory accounts, uint256[] memory amounts, uint256[] memory refunds,uint256 total) {
        total=contributors[id].length;
        if(offset>=total) return(new address[](0),new uint256[](0),new uint256[](0),total);
        if(limit>100) limit=100;
        uint256 count=total-offset; if(count>limit)count=limit;
        accounts=new address[](count);amounts=new uint256[](count);refunds=new uint256[](count);
        for(uint256 i;i<count;++i){address a=contributors[id][offset+i];accounts[i]=a;amounts[i]=contribution[id][a];refunds[i]=refunded[id][a];}
    }
    function contribute(uint256 id,uint128 amount) external nonReentrant {
        Bill storage b=bills[id];
        if(b.merchant==address(0))revert InvalidBill();
        if(b.settled||b.cancelled||block.timestamp>=b.deadline)revert Closed();
        if(amount==0||uint256(b.raised)+amount>b.target)revert InvalidAmount();
        if(contribution[id][msg.sender]==0){if(contributors[id].length>=100)revert InvalidBill();contributors[id].push(msg.sender);}
        contribution[id][msg.sender]+=amount;b.raised+=amount;_link(msg.sender,id);
        _call(abi.encodeCall(IERC20.transferFrom,(msg.sender,address(this),amount)));
        emit Contributed(id,msg.sender,amount);
        if(b.raised==b.target){b.settled=true;_call(abi.encodeCall(IERC20.transfer,(b.merchant,uint256(b.target))));emit Settled(id,b.merchant,b.target);}
    }
    function cancel(uint256 id) external {
        Bill storage b=bills[id];
        if(b.merchant!=msg.sender)revert Unauthorized();
        if(b.settled||b.cancelled)revert Closed();
        b.cancelled=true;emit Cancelled(id);
    }
    function claimRefund(uint256 id) external nonReentrant {
        Bill storage b=bills[id];
        if(b.merchant==address(0))revert InvalidBill();
        if(b.settled||(!b.cancelled&&block.timestamp<b.deadline))revert Closed();
        uint256 amount=contribution[id][msg.sender];
        if(amount==0||refunded[id][msg.sender]!=0)revert InvalidAmount();
        refunded[id][msg.sender]=amount;
        _call(abi.encodeCall(IERC20.transfer,(msg.sender,amount)));
        emit Refunded(id,msg.sender,amount);
    }
    function _link(address wallet,uint256 id) private {if(!linked[wallet][id]){linked[wallet][id]=true;walletBills[wallet].push(id);}}
    function _call(bytes memory data) private {
        (bool ok,bytes memory result)=address(USDC).call(data);
        if(!ok||(result.length!=0&&!abi.decode(result,(bool))))revert TransferFailed();
    }
}
