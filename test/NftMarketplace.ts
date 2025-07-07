import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import hre from "hardhat";
import { parseEther, getAddress } from "viem";
import { expect } from "chai";

describe("NftMarketplace", () => {
  const deployNftMarketplaceFixture = async () => {
    const TOKEN_ID = 0n;
    const PRICE = parseEther("0.1");

    const [deployer, player] = await hre.viem.getWalletClients();

    const nftMarketplace = await hre.viem.deployContract("NftMarketplace", [], {
      client: { wallet: deployer },
    });

    const basicNft = await hre.viem.deployContract("BasicNft", [], {
      client: { wallet: deployer },
    });
    await basicNft.write.mintNFT();
    await basicNft.write.approve([nftMarketplace.address, TOKEN_ID]);

    const publicClient = await hre.viem.getPublicClient();

    return {
      TOKEN_ID,
      PRICE,
      nftMarketplace,
      basicNft,
      publicClient,
      deployer,
      player,
    };
  };

  describe("listItem", () => {
    it("emits an event after listing an item", async () => {
      const {
        nftMarketplace,
        basicNft,
        TOKEN_ID,
        PRICE,
        publicClient,
        deployer,
      } = await loadFixture(deployNftMarketplaceFixture);

      const hash = await nftMarketplace.write.listItem([
        basicNft.address,
        TOKEN_ID,
        PRICE,
      ]);

      await publicClient.waitForTransactionReceipt({ hash });

      const itemListedEvents = await nftMarketplace.getEvents.ItemListed();
      expect(itemListedEvents).to.have.lengthOf(1);
      expect(itemListedEvents[0].args.nftAddress).to.equal(
        getAddress(basicNft.address)
      );
      expect(itemListedEvents[0].args.tokenId).to.equal(TOKEN_ID);
      expect(itemListedEvents[0].args.seller).to.equal(
        getAddress(deployer.account.address)
      );
      expect(itemListedEvents[0].args.price).to.equal(PRICE);
    });
  });
});
