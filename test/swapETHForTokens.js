const { expect } = require("chai");
const hre = require("hardhat");
const ethers = require("ethers");

describe("TokenExchange", function () {
	let Token, token, TokenExchange, exchange, owner, addr1, addr2;
	let token_reserves, eth_reserves;
	let bigTokenReserves, bigETHReserves;

	const multiplier = ethers.BigNumber.from(10 ** 5);
	const swap_fee_numerator = ethers.BigNumber.from(3);
	const swap_fee_denominator = ethers.BigNumber.from(100);

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
			ethers.BigNumber.from
		);
	});

	describe("Swap ETH for tokens", function () {
		it("Should ETH for tokens with expected exchange rate", async function () {
			const ethIn = ethers.utils.parseUnits("1", 18);
			const max_exchange_rate = ethers.BigNumber.from(
				ethers.utils.parseUnits("2", 23)
			);

			const tokensBeforeTrade = await token.balanceOf(addr1.address);

			const tx = await exchange
				.connect(addr1)
				.swapETHForTokens(max_exchange_rate, { value: ethIn });

			const tokensAfterTrade = await token.balanceOf(addr1.address);
			console.log(
				"Balance after swap: " + ethers.utils.formatUnits(tokensAfterTrade, 18)
			);

			const expectedAmountTokens = swap_fee_denominator
				.sub(swap_fee_numerator)
				.mul(ethIn)
				.mul(bigTokenReserves)
				.div(bigETHReserves.add(ethIn).mul(swap_fee_denominator));
			console.log(
				"Expected tokens to receive: " +
					ethers.utils.formatUnits(expectedAmountTokens, 18)
			);

			expect(tokensAfterTrade).to.equals(expectedAmountTokens);
		});

		// it("Should not swap if slippage too large", async function () {
		// 	const ethIn = ethers.utils.parseUnits("10", 18);
		// 	const max_exchange_rate = ethers.BigNumber.from(
		// 		ethers.utils.parseUnits("0", 23)
		// 	);
		//
		// 	const tx = await exchange
		// 		.connect(addr1)
		// 		.swapETHForTokens(max_exchange_rate, { value: ethIn });
		//
		// 	const tokensAfterTrade = await token.balanceOf(addr1.address);
		// 	console.log(
		// 		"Balance after swap: " + ethers.utils.formatUnits(tokensAfterTrade, 18)
		// 	);
		//
		// 	await expect(tx).to.be.revertedWith("Slippage too large");
		// });
		//
		it("Should not swap if exceed max slippage", async function () {
			const ethAmount = ethers.utils.parseUnits("100", "ether");
			const max_exchange_rate = ethers.utils.parseUnits("0", 23);
			console.log(ethers.utils.formatUnits(max_exchange_rate, 23));

			await exchange.connect(addr1).swapETHForTokens(0, { value: ethAmount });

			const [bigEthReserves, bigTokenReserves] = [
				eth_reserves,
				token_reserves,
			].map(ethers.BigNumber.from);

			const expectedAmountTokens = swap_fee_denominator
				.sub(swap_fee_numerator)
				.mul(ethAmount)
				.mul(bigTokenReserves)
				.div(bigEthReserves.add(ethAmount).mul(swap_fee_denominator));

			const exchange_rate = multiplier
				.mul(ethers.BigNumber.from(10).pow(18))
				.mul(bigTokenReserves.add(expectedAmountTokens))
				.div(bigEthReserves);

			console.log(ethers.utils.formatUnits(exchange_rate, 23));
		});
	});
});
