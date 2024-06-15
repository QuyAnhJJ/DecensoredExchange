const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { utils, BigNumber } = require("ethers");

describe("TokenExchange", function () {
	let Token, token, TokenExchange, exchange, owner, addr1, addr2;
	let token_reserves, eth_reserves;

	const multiplier = BigNumber.from(10 ** 5);
	const swap_fee_numerator = BigNumber.from(3);
	const swap_fee_denominator = BigNumber.from(100);

	// beforeEach resets the network, deploys contracts, creates liquidity pool
	beforeEach(async function () {
		await network.provider.request({
			method: "hardhat_reset",
			params: [],
		});

		[owner, addr1, addr2] = await ethers.getSigners();

		// Deploy the Token contract
		Token = await ethers.getContractFactory("Token");
		token = await Token.deploy();

		// Deploy the TokenExchange contract
		TokenExchange = await ethers.getContractFactory("TokenExchange");
		exchange = await TokenExchange.deploy();

		// Mint tokens to the owner
		token_reserves = utils.parseUnits("5000", 18);
		await token.mint(token_reserves);

		// Approve the exchange contract to spend owner's tokens
		await token.approve(exchange.address, token_reserves);

		// Create the liquidity pool
		eth_reserves = utils.parseUnits("5000", "ether");
		await exchange.createPool(token_reserves, { value: eth_reserves });
	});

	describe("Swap ETH for Tokens", () => {
		it("Should swap ETH for token", async function () {
			const ethAmount = utils.parseUnits("1", "ether");
			await exchange.connect(addr1).swapETHForTokens(5, { value: ethAmount });

			const [bigEthReserves, bigTokenReserves] = [
				eth_reserves,
				token_reserves,
			].map(BigNumber.from);

			const expectedAmountTokens = swap_fee_denominator
				.sub(swap_fee_numerator)
				.mul(ethAmount)
				.mul(bigTokenReserves)
				.div(bigEthReserves.add(ethAmount).mul(swap_fee_denominator));

			expect(await ethers.provider.getBalance(exchange.address)).to.equal(
				eth_reserves.add(ethAmount)
			);

			// Get the token balance of addr1
			const tokenBalanceAfter = await token.balanceOf(addr1.address);
			// Verify the token balance is as expected
			expect(tokenBalanceAfter).to.equal(expectedAmountTokens);
		});

		it("Should not swap if exceed max slippage", async function () {
			const ethAmount = utils.parseUnits("100", "ether");
			const max_exchange_rate = utils.parseUnits("0", 23);
			console.log(utils.formatUnits(max_exchange_rate, 23));
			await exchange.connect(addr1).swapETHForTokens(0, { value: ethAmount });

			const [bigEthReserves, bigTokenReserves] = [
				eth_reserves,
				token_reserves,
			].map(BigNumber.from);

			const expectedAmountTokens = swap_fee_denominator
				.sub(swap_fee_numerator)
				.mul(ethAmount)
				.mul(bigTokenReserves)
				.div(bigEthReserves.add(ethAmount).mul(swap_fee_denominator));

			const exchange_rate = multiplier
				.mul(BigNumber.from(10).pow(18))
				.mul(bigTokenReserves.add(expectedAmountTokens))
				.div(bigEthReserves);

			console.log(utils.formatUnits(exchange_rate, 23));
		});
	});
});
