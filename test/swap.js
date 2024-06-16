const { expect } = require("chai");
const hre = require("hardhat");
const ethers = require("ethers");

let Token, token, TokenExchange, exchange, owner, addr1, addr2;
let token_reserves, eth_reserves;
let bigTokenReserves, bigETHReserves;

const multiplier = ethers.BigNumber.from(10 ** 5);
const swap_fee_numerator = ethers.BigNumber.from(3);
const swap_fee_denominator = ethers.BigNumber.from(100);

describe("TokenExchange", function () {
	// beforeEach resets the network, deploys contracts, creates liquidity pool
	beforeEach(async function () {
		await hre.network.provider.request({
			method: "hardhat_reset",
			params: [],
		});

		[owner, addr1, addr2] = await hre.ethers.getSigners();

		// Deploy the Token contract
		Token = await hre.ethers.getContractFactory("Token");
		token = await Token.deploy();

		// Deploy the TokenExchange contract
		TokenExchange = await hre.ethers.getContractFactory("TokenExchange");
		exchange = await TokenExchange.deploy();

		// Mint tokens to the owner
		token_reserves = ethers.utils.parseUnits("5000", 18);
		await token.mint(token_reserves);

		// Approve the exchange contract to spend owner's tokens
		await token.approve(exchange.address, token_reserves);

		// Create the liquidity pool
		eth_reserves = ethers.utils.parseUnits("5000", "ether");
		await exchange.createPool(token_reserves, { value: eth_reserves });

		[bigETHReserves, bigTokenReserves] = [eth_reserves, token_reserves].map(
			ethers.BigNumber.from,
		);
	});

	describe("Swap Tokens for ETH - normal", function () {
		it("Should swap tokens for ETH with expected echange rate", async function () {
			const tokenAmount = ethers.utils.parseUnits("1", 18);

			await giveTokens(addr1, tokenAmount);

			const max_exchange_rate = ethers.BigNumber.from(
				ethers.utils.parseUnits("2", 23),
			);

			const balanceBeforeTrade = await hre.ethers.provider.getBalance(
				addr1.address,
			);

			const tx = await exchange
				.connect(addr1)
				.swapTokensForETH(tokenAmount, max_exchange_rate);

			const receipt = await tx.wait();
			const gasUsed = receipt.gasUsed;
			const gasPrice = tx.gasPrice;
			const gasFee = gasUsed.mul(gasPrice);

			const expectedETH = getAmountOut(
				tokenAmount,
				bigTokenReserves,
				bigETHReserves,
			);

			const balanceAfterTrade = await hre.ethers.provider.getBalance(
				addr1.address,
			);

			expect(balanceBeforeTrade.sub(gasFee).add(expectedETH)).to.equal(
				balanceAfterTrade,
			);
		});

		it("Should not swap if slippage too large", async function () {
			const tokenAmount = ethers.utils.parseUnits("1", 18);

			await giveTokens(addr1, tokenAmount);

			const max_exchange_rate = ethers.BigNumber.from(
				ethers.utils.parseUnits("1", 23),
			);

			const tx = exchange
				.connect(addr1)
				.swapTokensForETH(tokenAmount, max_exchange_rate);

			await expect(tx).to.be.revertedWith("Slippage too large");
		});

		it("Should not swap if don't have enough tokens", async function () {
			const tokenAmount = ethers.utils.parseUnits("1", 18);

			const max_exchange_rate = ethers.BigNumber.from(
				ethers.utils.parseUnits("2", 23),
			);

			const tx = exchange
				.connect(addr1)
				.swapTokensForETH(tokenAmount, max_exchange_rate);

			await expect(tx).to.be.revertedWith("Not enough STD to swap");
		});
	});

	describe("Special cases", () => {
		it("Should reject if max_slippage is negative", async function () {
			const tokenAmount = ethers.utils.parseUnits("1", 18);

			await giveTokens(addr1, tokenAmount);

			const max_exchange_rate = ethers.BigNumber.from(
				ethers.utils.parseUnits("-1", 23),
			);

			await expect(
				exchange
					.connect(addr1)
					.swapTokensForETH(tokenAmount, max_exchange_rate),
			).to.be.rejectedWith(Error);
		});
	});

	describe("Swap ETH for tokens", function () {
		it("Should ETH for tokens with expected exchange rate", async function () {
			const ethIn = ethers.utils.parseUnits("1", 18);
			const max_exchange_rate = ethers.BigNumber.from(
				ethers.utils.parseUnits("2", 23),
			);

			const tokensBeforeTrade = await token.balanceOf(addr1.address);

			const tx = await exchange
				.connect(addr1)
				.swapETHForTokens(max_exchange_rate, { value: ethIn });

			const tokensAfterTrade = await token.balanceOf(addr1.address);
			console.log(
				"Balance after swap: " + ethers.utils.formatUnits(tokensAfterTrade, 18),
			);

			const expectedAmountTokens = getAmountOut(
				ethIn,
				bigETHReserves,
				bigTokenReserves,
			);
			console.log(
				"Expected tokens to receive: " +
					ethers.utils.formatUnits(expectedAmountTokens, 18),
			);

			expect(tokensAfterTrade).to.equals(expectedAmountTokens);
		});
	});
});

async function giveTokens(addr, amount) {
	await token.mint(amount);
	await token.approve(addr.address, amount);
	await token.transfer(addr.address, amount);
	await token.connect(addr).approve(exchange.address, amount);
}

function getAmountOut(amountIn, reserveIn, reserveOut) {
	return swap_fee_denominator
		.sub(swap_fee_numerator)
		.mul(amountIn)
		.mul(reserveOut)
		.div(reserveIn.add(amountIn).mul(swap_fee_denominator));
}
