// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";
import {Ownable} from "./utils/Ownable.sol";

/**
 * @title PulseVault
 * @notice Holds user deposits (USDC) for the Pulse DEX.
 *         Users deposit USDC on L1/L2, and the backend credits their trading balance.
 *         Withdrawals require operator signature (or can be forced after timelock).
 * 
 * Security model:
 * - Deposits are permissionless (anyone can deposit)
 * - Withdrawals require operator approval (signed message) OR
 * - Users can force-withdraw after WITHDRAWAL_DELAY if operator is unresponsive (escape hatch)
 * - Emergency pause stops all operations
 */
contract PulseVault is ReentrancyGuard, Ownable {
    // ─── State ─────────────────────────────────────────────────

    IERC20 public immutable usdc;
    address public operator;
    bool public paused;
    
    uint256 public constant WITHDRAWAL_DELAY = 7 days; // Escape hatch delay
    uint256 public constant MAX_WITHDRAWAL_PER_TX = 1_000_000 * 1e6; // 1M USDC

    // User balances tracked on-chain (for escape hatch)
    mapping(address => uint256) public deposits;
    mapping(address => uint256) public totalDeposited;
    mapping(address => uint256) public totalWithdrawn;
    
    // Pending forced withdrawals (escape hatch)
    struct PendingWithdrawal {
        uint256 amount;
        uint256 requestTime;
        bool executed;
    }
    mapping(address => PendingWithdrawal) public pendingWithdrawals;

    // Nonce for replay protection
    mapping(address => uint256) public nonces;

    // ─── Events ────────────────────────────────────────────────

    event Deposited(address indexed user, uint256 amount, uint256 timestamp);
    event Withdrawn(address indexed user, uint256 amount, uint256 timestamp);
    event WithdrawalRequested(address indexed user, uint256 amount, uint256 executeAfter);
    event ForcedWithdrawal(address indexed user, uint256 amount, uint256 timestamp);
    event OperatorUpdated(address indexed oldOperator, address indexed newOperator);
    event Paused(bool isPaused);

    // ─── Errors ────────────────────────────────────────────────

    error ZeroAmount();
    error InsufficientBalance();
    error ContractPaused();
    error InvalidSignature();
    error WithdrawalTooLarge();
    error WithdrawalNotReady();
    error WithdrawalAlreadyPending();
    error NotOperator();
    error TransferFailed();

    // ─── Constructor ───────────────────────────────────────────

    constructor(address _usdc, address _operator) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        operator = _operator;
    }

    // ─── Modifiers ─────────────────────────────────────────────

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    // ─── Deposit ───────────────────────────────────────────────

    /**
     * @notice Deposit USDC into the vault
     * @param amount Amount of USDC (6 decimals) to deposit
     */
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();

        bool success = usdc.transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();

        deposits[msg.sender] += amount;
        totalDeposited[msg.sender] += amount;

        emit Deposited(msg.sender, amount, block.timestamp);
    }

    /**
     * @notice Deposit USDC on behalf of another user
     * @param user The user to credit
     * @param amount Amount of USDC to deposit
     */
    function depositFor(address user, uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (user == address(0)) revert ZeroAmount();

        bool success = usdc.transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();

        deposits[user] += amount;
        totalDeposited[user] += amount;

        emit Deposited(user, amount, block.timestamp);
    }

    // ─── Operator Withdrawal (normal flow) ─────────────────────

    /**
     * @notice Process a withdrawal approved by the operator
     * @param user The user to withdraw for
     * @param amount Amount of USDC to withdraw
     * @param nonce User's nonce for replay protection
     * @param signature Operator's signature approving the withdrawal
     */
    function withdraw(
        address user,
        uint256 amount,
        uint256 nonce,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (amount > MAX_WITHDRAWAL_PER_TX) revert WithdrawalTooLarge();
        if (nonce != nonces[user]) revert InvalidSignature();

        // Verify operator signature
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encode(user, amount, nonce, block.chainid, address(this)))
            )
        );

        address signer = recoverSigner(messageHash, signature);
        if (signer != operator) revert InvalidSignature();

        // Update state
        nonces[user]++;
        
        if (deposits[user] >= amount) {
            deposits[user] -= amount;
        } else {
            deposits[user] = 0;
        }
        totalWithdrawn[user] += amount;

        // Transfer USDC
        bool success = usdc.transfer(user, amount);
        if (!success) revert TransferFailed();

        emit Withdrawn(user, amount, block.timestamp);
    }

    // ─── Escape Hatch (forced withdrawal) ──────────────────────

    /**
     * @notice Request a forced withdrawal (if operator is unresponsive)
     *         Can be executed after WITHDRAWAL_DELAY
     * @param amount Amount to withdraw (capped at deposit balance)
     */
    function requestForcedWithdrawal(uint256 amount) external whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (deposits[msg.sender] < amount) revert InsufficientBalance();
        if (pendingWithdrawals[msg.sender].amount > 0 && !pendingWithdrawals[msg.sender].executed) {
            revert WithdrawalAlreadyPending();
        }

        pendingWithdrawals[msg.sender] = PendingWithdrawal({
            amount: amount,
            requestTime: block.timestamp,
            executed: false
        });

        emit WithdrawalRequested(msg.sender, amount, block.timestamp + WITHDRAWAL_DELAY);
    }

    /**
     * @notice Execute a forced withdrawal after the delay period
     */
    function executeForcedWithdrawal() external nonReentrant {
        PendingWithdrawal storage pw = pendingWithdrawals[msg.sender];
        
        if (pw.amount == 0) revert ZeroAmount();
        if (pw.executed) revert ZeroAmount();
        if (block.timestamp < pw.requestTime + WITHDRAWAL_DELAY) revert WithdrawalNotReady();

        uint256 amount = pw.amount;
        pw.executed = true;
        
        if (deposits[msg.sender] >= amount) {
            deposits[msg.sender] -= amount;
        } else {
            amount = deposits[msg.sender];
            deposits[msg.sender] = 0;
        }
        totalWithdrawn[msg.sender] += amount;

        bool success = usdc.transfer(msg.sender, amount);
        if (!success) revert TransferFailed();

        emit ForcedWithdrawal(msg.sender, amount, block.timestamp);
    }

    /**
     * @notice Cancel a pending forced withdrawal
     */
    function cancelForcedWithdrawal() external {
        PendingWithdrawal storage pw = pendingWithdrawals[msg.sender];
        if (pw.amount == 0 || pw.executed) revert ZeroAmount();
        pw.amount = 0;
        pw.executed = true;
    }

    // ─── Admin Functions ───────────────────────────────────────

    function setOperator(address newOperator) external onlyOwner {
        emit OperatorUpdated(operator, newOperator);
        operator = newOperator;
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    // ─── View Functions ────────────────────────────────────────

    function getBalance(address user) external view returns (uint256) {
        return deposits[user];
    }

    function getVaultBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    // ─── Internal ──────────────────────────────────────────────

    function recoverSigner(bytes32 hash, bytes calldata sig) internal pure returns (address) {
        require(sig.length == 65, "Invalid signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (v < 27) v += 27;
        return ecrecover(hash, v, r, s);
    }
}
