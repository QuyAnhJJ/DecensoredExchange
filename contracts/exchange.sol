// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./token.sol";
import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract TokenExchange is Ownable {
    string public exchange_name = "STD Exchange";

    address tokenAddr = 0x5FbDB2315678afecb367f032d93F642f64180aa3;
    Token public token = Token(tokenAddr);

    // Liquidity pool for the exchange
    uint private token_reserves = 0;
    uint private eth_reserves = 0;

    // Fee Pools
    uint private token_fee_reserves = 0;
    uint private eth_fee_reserves = 0;

    // Liquidity pool shares
    mapping(address => uint) private lps;

    // For Extra Credit only: to loop through the keys of the lps mapping
    address[] private lp_providers;

    // Total Pool Shares
    uint private total_shares = 0;

    // liquidity rewards
    uint private swap_fee_numerator = 3;
    uint private swap_fee_denominator = 100;

    // Constant: x * y = k
    uint private k;

    // For use with exchange rates
    uint private multiplier = 10 ** 5;

    constructor() {}

    // Function createPool: Initializes a liquidity pool between your Token and ETH.
    // ETH will be sent to pool in this transaction as msg.value
    // amountTokens specifies the amount of tokens to transfer from the liquidity provider.
    // Sets up the initial exchange rate for the pool by setting amount of token and amount of ETH.
    function createPool(uint amountTokens) external payable onlyOwner {
        // This function is already implemented for you; no changes needed.
        // require pool does not yet exist:
        require(token_reserves == 0, "Token reserves was not 0");
        require(eth_reserves == 0, "ETH reserves was not 0.");

        // require nonzero values were sent
        require(msg.value > 0, "Need eth to create pool.");
        uint tokenSupply = token.balanceOf(msg.sender);
        require(
            amountTokens <= tokenSupply,
            "Not have enough tokens to create the pool"
        );
        require(amountTokens > 0, "Need tokens to create pool.");

        token.transferFrom(msg.sender, address(this), amountTokens);
        token_reserves = token.balanceOf(address(this));
        eth_reserves = msg.value;
        k = token_reserves * eth_reserves;

        // Pool shares set to a large value to minimize round-off errors
        total_shares = 10 ** 5;
        // Pool creator has some low amount of shares to allow autograder to run
        lps[msg.sender] = 100;
    }

    // For use for ExtraCredit ONLY
    // Function removeLP: removes a liquidity provider from the list.
    // This function also removes the gap left over from simply running "delete".
    function removeLP(uint index) private {
        require(
            index < lp_providers.length,
            "specified index is larger than the number of lps"
        );
        lp_providers[index] = lp_providers[lp_providers.length - 1];
        lp_providers.pop();
    }

    // Function getSwapFee: Returns the current swap fee ratio to the client.
    function getSwapFee() public view returns (uint, uint) {
        return (swap_fee_numerator, swap_fee_denominator);
    }

    /* ========================= Liquidity Provider Functions =========================  */

    // Function addLiquidity: Adds liquidity given a supply of ETH (sent to the contract as msg.value).
    // You can change the inputs, or the scope of your function, as needed.
    function addLiquidity(
        uint min_exchange_rate,
        uint max_exchange_rate
    ) external payable {
        require(token_reserves > 0, "Liquidity pool has not been created yet");
        require(eth_reserves > 0, "Liquidity pool has not been created yet");
        require(msg.value > 0, "Need eth to add liquidity");

        checkExchangeRate(min_exchange_rate, max_exchange_rate);

        uint tokenAmount = (msg.value * token_reserves) / eth_reserves;
        uint tokenSupply = token.balanceOf(msg.sender);

        require(
            tokenAmount <= tokenSupply,
            "Not enough tokens to add liquidity"
        );
        token.transferFrom(msg.sender, address(this), tokenAmount);

        token_reserves = token.balanceOf(address(this));
        eth_reserves = address(this).balance;
        k = token_reserves * eth_reserves;

        total_shares += (msg.value * total_shares) / eth_reserves;
        lps[msg.sender] += (msg.value * total_shares) / eth_reserves;
    }

    // Function removeLiquidity: Removes liquidity given the desired amount of ETH to remove.
    // You can change the inputs, or the scope of your function, as needed.
    function removeLiquidity(
        uint amountETH,
        uint min_exchange_rate,
        uint max_exchange_rate
    ) public payable {
        require(token_reserves > 0, "Liquidity pool has not been created yet");
        require(eth_reserves > 0, "Liquidity pool has not been created yet");

        checkExchangeRate(min_exchange_rate, max_exchange_rate);

        uint shares_withdraw = (amountETH * total_shares) / eth_reserves;
        require(
            shares_withdraw <= lps[msg.sender],
            "Not enough shares to withdraw given amount"
        );

        uint tokenAmount = (token_reserves * shares_withdraw) / total_shares;
        uint ethAmount = (eth_reserves * shares_withdraw) / total_shares;

        require(tokenAmount < token_reserves, "Can't remove all liquidity");
        require(ethAmount < eth_reserves, "Can't remove all liquidity");

        token.transfer(msg.sender, tokenAmount);
        payable(msg.sender).transfer(ethAmount);

        token_reserves = token.balanceOf(address(this));
        eth_reserves = address(this).balance;
        k = token_reserves * eth_reserves;

        total_shares -= shares_withdraw;
        lps[msg.sender] -= shares_withdraw;
    }

    // Function removeAllLiquidity: Removes all liquidity that msg.sender is entitled to withdraw
    // You can change the inputs, or the scope of your function, as needed.
    function removeAllLiquidity(
        uint min_exchange_rate,
        uint max_exchange_rate
    ) external payable {
        require(token_reserves > 0, "Liquidity pool has not been created yet");
        require(eth_reserves > 0, "Liquidity pool has not been created yet");

        checkExchangeRate(min_exchange_rate, max_exchange_rate);

        uint ethAmount = (eth_reserves * lps[msg.sender]) / total_shares;
        uint tokenAmount = (token_reserves * lps[msg.sender]) / total_shares;

        require(tokenAmount < token_reserves, "Can't remove all liquidity");
        require(ethAmount < eth_reserves, "Can't remove all liquidity");

        token.transfer(msg.sender, tokenAmount);
        payable(msg.sender).transfer(ethAmount);

        token_reserves = token.balanceOf(address(this));
        eth_reserves = address(this).balance;
        k = token_reserves * eth_reserves;

        total_shares -= lps[msg.sender];
        lps[msg.sender] = 0;
    }

    /* ========================= Swap Functions =========================  */

    // Function swapTokensForETH: Swaps your token with ETH
    // You can change the inputs, or the scope of your function, as needed.
    function swapTokensForETH(
        uint amountTokens,
        uint max_exchange_rate
    ) external payable {
        require(token_reserves > 0, "Liquidity pool has not been created yet");
        require(eth_reserves > 0, "Liquidity pool has not been created yet");
        require(
            token.balanceOf(msg.sender) >= amountTokens,
            "Not enough STD to swap"
        );

        uint exchange_rate = (multiplier *
            10 ** 18 *
            (token_reserves + amountTokens)) / eth_reserves;
        require(exchange_rate <= max_exchange_rate, "Slippage too large");

        uint amountETH = ((swap_fee_denominator - swap_fee_numerator) *
            (amountTokens * eth_reserves)) /
            ((token_reserves + amountTokens) * swap_fee_denominator);
        require(
            amountETH < address(this).balance,
            "Not enough ETH in the pool"
        );

        token.transferFrom(msg.sender, address(this), amountTokens);
        payable(msg.sender).transfer(amountETH);

        token_reserves = token.balanceOf(address(this));
        eth_reserves = address(this).balance;
    }

    // Function swapETHForTokens: Swaps ETH for your tokens
    // ETH is sent to contract as msg.value
    // You can change the inputs, or the scope of your function, as needed.
    function swapETHForTokens(uint max_exchange_rate) external payable {
        require(token_reserves > 0, "Liquidity pool has not been created yet");
        require(eth_reserves > 0, "Liquidity pool has not been created yet");
        require(msg.value > 0, "Need ETH to swap");

        uint exchange_rate = (multiplier * (eth_reserves + msg.value)) /
            (token_reserves);
        require(exchange_rate <= max_exchange_rate, "Slippage too large");

        uint amountTokens = ((swap_fee_denominator - swap_fee_numerator) *
            (msg.value * token_reserves)) /
            ((eth_reserves + msg.value) * swap_fee_denominator);
        require(
            amountTokens < token.balanceOf(address(this)),
            "Not enough STD in the pool"
        );

        token.transfer(msg.sender, amountTokens);

        token_reserves = token.balanceOf(address(this));
        eth_reserves = address(this).balance;
    }

    // Function getLiquidity: Returns the current liquidity pool reserves
    function getLiquidity() public view returns (uint, uint) {
        return (token_reserves, eth_reserves);
    }

    // Function checkExchangeRate: onyl executes if the current exchange rate is within the min and max
    function checkExchangeRate(
        uint min_exchange_rate,
        uint max_exchange_rate
    ) internal view {
        uint exchange_rate = (10 ** 18 * multiplier * token_reserves) /
            eth_reserves;
        require(exchange_rate >= min_exchange_rate, "Slippage too large");
        require(exchange_rate <= max_exchange_rate, "Slippage too large");
    }
}

