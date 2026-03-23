// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {Ownable} from "./utils/Ownable.sol";
import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";

/**
 * @title PulseToken
 * @notice The PULSE governance and utility token for Pulse DEX
 *         Total supply: 1,000,000,000 PULSE
 */
contract PulseToken is IERC20, Ownable {
    string public constant name = "Pulse";
    string public constant symbol = "PULSE";
    uint8 public constant decimals = 18;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    constructor(address treasury) Ownable(msg.sender) {
        _totalSupply = 1_000_000_000 * 1e18; // 1B tokens
        _balances[treasury] = _totalSupply;
        emit Transfer(address(0), treasury, _totalSupply);
    }

    function totalSupply() external view override returns (uint256) { return _totalSupply; }
    function balanceOf(address account) external view override returns (uint256) { return _balances[account]; }

    function transfer(address to, uint256 amount) external override returns (bool) {
        require(_balances[msg.sender] >= amount, "Insufficient balance");
        _balances[msg.sender] -= amount;
        _balances[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function allowance(address owner_, address spender) external view override returns (uint256) {
        return _allowances[owner_][spender];
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        require(_balances[from] >= amount, "Insufficient balance");
        require(_allowances[from][msg.sender] >= amount, "Insufficient allowance");
        _balances[from] -= amount;
        _balances[to] += amount;
        _allowances[from][msg.sender] -= amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

/**
 * @title PulseStaking
 * @notice Stake PULSE tokens to get:
 *         - LLP access (1 PULSE staked = 10 USDC deposit capacity in LLP)
 *         - Funding rate rebates (up to 15%)
 *         - Zero withdrawal fees (100+ PULSE staked)
 *         - Staking yield
 */
contract PulseStaking is ReentrancyGuard, Ownable {
    IERC20 public immutable pulseToken;
    
    struct StakeInfo {
        uint256 amount;
        uint256 stakedAt;
        uint256 rewardDebt;
    }

    mapping(address => StakeInfo) public stakes;
    uint256 public totalStaked;
    uint256 public rewardPerTokenStored;
    uint256 public lastRewardTime;
    uint256 public rewardRate; // tokens per second

    uint256 public constant LLP_ACCESS_RATIO = 10; // 1 PULSE = 10 USDC in LLP
    uint256 public constant FEE_FREE_THRESHOLD = 100 * 1e18; // 100 PULSE for free withdrawals
    uint256 public constant MAX_FUNDING_REBATE_BPS = 1500; // 15% max rebate
    uint256 public constant UNSTAKE_DELAY = 7 days;

    // Pending unstakes
    mapping(address => uint256) public pendingUnstakeAmount;
    mapping(address => uint256) public pendingUnstakeTime;

    event Staked(address indexed user, uint256 amount);
    event UnstakeRequested(address indexed user, uint256 amount, uint256 availableAt);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 reward);

    constructor(address _pulseToken) Ownable(msg.sender) {
        pulseToken = IERC20(_pulseToken);
        lastRewardTime = block.timestamp;
    }

    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Cannot stake 0");

        _updateReward(msg.sender);

        pulseToken.transferFrom(msg.sender, address(this), amount);
        
        stakes[msg.sender].amount += amount;
        stakes[msg.sender].stakedAt = block.timestamp;
        totalStaked += amount;

        emit Staked(msg.sender, amount);
    }

    function requestUnstake(uint256 amount) external {
        require(stakes[msg.sender].amount >= amount, "Insufficient stake");
        require(pendingUnstakeAmount[msg.sender] == 0, "Unstake already pending");

        _updateReward(msg.sender);

        stakes[msg.sender].amount -= amount;
        totalStaked -= amount;
        pendingUnstakeAmount[msg.sender] = amount;
        pendingUnstakeTime[msg.sender] = block.timestamp + UNSTAKE_DELAY;

        emit UnstakeRequested(msg.sender, amount, block.timestamp + UNSTAKE_DELAY);
    }

    function executeUnstake() external nonReentrant {
        require(pendingUnstakeAmount[msg.sender] > 0, "No pending unstake");
        require(block.timestamp >= pendingUnstakeTime[msg.sender], "Delay not passed");

        uint256 amount = pendingUnstakeAmount[msg.sender];
        pendingUnstakeAmount[msg.sender] = 0;

        pulseToken.transfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    function claimReward() external nonReentrant {
        _updateReward(msg.sender);
        uint256 reward = stakes[msg.sender].rewardDebt;
        if (reward > 0) {
            stakes[msg.sender].rewardDebt = 0;
            pulseToken.transfer(msg.sender, reward);
            emit RewardClaimed(msg.sender, reward);
        }
    }

    // ─── View Functions ────────────────────────────────────────

    function getLLPCapacity(address user) external view returns (uint256) {
        return stakes[user].amount * LLP_ACCESS_RATIO / 1e18 * 1e6; // USDC has 6 decimals
    }

    function hasFreeWithdrawals(address user) external view returns (bool) {
        return stakes[user].amount >= FEE_FREE_THRESHOLD;
    }

    function getFundingRebateBps(address user) external view returns (uint256) {
        if (stakes[user].amount == 0) return 0;
        // Linear scaling: 0 to MAX_FUNDING_REBATE_BPS based on stake size
        // Full rebate at 10,000 PULSE staked
        uint256 scaledAmount = stakes[user].amount / 1e18;
        if (scaledAmount >= 10000) return MAX_FUNDING_REBATE_BPS;
        return (scaledAmount * MAX_FUNDING_REBATE_BPS) / 10000;
    }

    function getStakeInfo(address user) external view returns (uint256 staked, uint256 pendingReward, uint256 llpCapacity) {
        staked = stakes[user].amount;
        pendingReward = stakes[user].rewardDebt + _pendingReward(user);
        llpCapacity = staked * LLP_ACCESS_RATIO / 1e18 * 1e6;
    }

    // ─── Admin ─────────────────────────────────────────────────

    function setRewardRate(uint256 _rewardRate) external onlyOwner {
        _updateGlobalReward();
        rewardRate = _rewardRate;
    }

    // ─── Internal ──────────────────────────────────────────────

    function _updateReward(address user) internal {
        _updateGlobalReward();
        if (user != address(0)) {
            stakes[user].rewardDebt += _pendingReward(user);
        }
    }

    function _updateGlobalReward() internal {
        if (totalStaked > 0) {
            uint256 elapsed = block.timestamp - lastRewardTime;
            rewardPerTokenStored += (elapsed * rewardRate * 1e18) / totalStaked;
        }
        lastRewardTime = block.timestamp;
    }

    function _pendingReward(address user) internal view returns (uint256) {
        if (stakes[user].amount == 0) return 0;
        uint256 currentRewardPerToken = rewardPerTokenStored;
        if (totalStaked > 0) {
            uint256 elapsed = block.timestamp - lastRewardTime;
            currentRewardPerToken += (elapsed * rewardRate * 1e18) / totalStaked;
        }
        return (stakes[user].amount * currentRewardPerToken) / 1e18;
    }
}
