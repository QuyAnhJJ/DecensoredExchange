const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const BigNumber = require("bignumber.js");

describe("TokenExchange", function () {
	let Token, token, TokenExchange, exchange, owner, addr1, addr2;
	let token_reserves, eth_reserves;

	const multiplier = new BigNumber(10 ** 5);
	const swap_fee_numerator = new BigNumber(3);
	const swap_fee_denominator = new BigNumber(100);

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
		token_reserves = ethers.utils.parseUnits("5000", 18);
		await token.mint(token_reserves);

		// Approve the exchange contract to spend owner's tokens
		await token.approve(exchange.address, token_reserves);

		// Create the liquidity pool
		eth_reserves = ethers.utils.parseUnits("5000", "ether");
		await exchange.createPool(token_reserves, { value: eth_reserves });
	});

	it("Should create liquidity pool with correct amount of tokens and ETH", async function () {
		expect(await token.balanceOf(exchange.address)).to.equal(token_reserves);
		expect(await ethers.provider.getBalance(exchange.address)).to.equal(
			eth_reserves
		);
	});

	it("Should return the correct amount of liquidity", async function () {
		const [tokenReserves, ethReserves] = await exchange.getLiquidity();
		expect(tokenReserves).to.equal(token_reserves);
		expect(ethReserves).to.equal(eth_reserves);
	});
});
