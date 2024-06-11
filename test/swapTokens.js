const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { utils, BigNumber } = require("ethers");

describe("TokenExchange", function () {
	let Token, token, TokenExchange, exchange, owner, addr1, addr2;
	let token_reserves, eth_reserves;
	let bigTokenReserves, bigETHReserves;

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

		[bigETHReserves, bigTokenReserves] = [eth_reserves, token_reserves].map(
			BigNumber.from
		);
	});

	describe("Swap Tokens for ETH", () => {
		it("Should swap tokens for ETH", async function () {
			const tokenAmount = utils.parseUnits("1", 18);

			await token.mint(tokenAmount);
			await token.approve(addr1.address, tokenAmount);
			await token.transfer(addr1.address, tokenAmount);
			await token.connect(addr1).approve(exchange.address, tokenAmount);

			const max_exchange_rate = BigNumber.from(utils.parseUnits("2", 23));

			await exchange
				.connect(addr1)
				.swapTokensForETH(tokenAmount, max_exchange_rate);

			const expectedETH = swap_fee_denominator
				.sub(swap_fee_numerator)
				.mul(tokenAmount)
				.mul(bigETHReserves)
				.div(bigTokenReserves.add(tokenAmount).mul(swap_fee_denominator));

			const exchange_rate = multiplier
				.mul(BigNumber.from(10).pow(18))
				.mul(bigETHReserves.add(expectedETH))
				.div(bigTokenReserves);

			console.log(utils.formatUnits(exchange_rate, 23));
		});

		it("Should not swap if slippage too large", async function () {
			const tokenAmount = utils.parseUnits("1", 18);

			await token.mint(tokenAmount);
			await token.approve(addr1.address, tokenAmount);
			await token.transfer(addr1.address, tokenAmount);
			await token.connect(addr1).approve(exchange.address, tokenAmount);

			const max_exchange_rate = BigNumber.from(utils.parseUnits("1", 23));

			await expect(
				exchange.connect(addr1).swapTokensForETH(tokenAmount, max_exchange_rate)
			).to.be.revertedWith("Slippage too large");
		});
	});
});
