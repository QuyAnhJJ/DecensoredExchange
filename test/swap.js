const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("TokenExchange", function () {
	let Token, token, TokenExchange, exchange, owner, addr1, addr2;
	let token_reserves, eth_reserves;

	const multiplier = ethers.BigNumber.from(10 ** 5);
	const swap_fee_numerator = ethers.BigNumber.from(3);
	const swap_fee_denominator = ethers.BigNumber.from(100);

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

	describe("Swap ETH for Tokens", () => {
		it("Normal swap ETH", async function () {
			const ethAmount = ethers.utils.parseUnits("1", "ether");
			await exchange.connect(addr1).swapETHForTokens(5, { value: ethAmount });

			const bigEthReserves = ethers.BigNumber.from(eth_reserves.toString());

			const bigTokenReserves = ethers.BigNumber.from(token_reserves);

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
	});
});
