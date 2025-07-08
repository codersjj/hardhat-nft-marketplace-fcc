import hre from "hardhat";
import { parseGwei } from "viem";
import BasicNftModule from "../ignition/modules/BasicNft";
import NftMarketplaceModule from "../ignition/modules/NftMarketplace";

const PRICE = parseGwei("520");

async function main() {
  const { basicNft } = await hre.ignition.deploy(BasicNftModule);
  console.log("Basic NFT deployed to:", basicNft.address);
  console.log("Minting NFT...");
  const hash = await basicNft.write.mintNFT();
  const publicClient = await hre.viem.getPublicClient();
  await publicClient.waitForTransactionReceipt({ hash });

  console.log("NFT minted successfully!");

  const dogMintedEvents = await basicNft.getEvents.DogMinted();

  let tokenId = -1n;
  if (dogMintedEvents.length > 0) {
    tokenId = dogMintedEvents[0].args.tokenId!;
    console.log("Token ID of minted NFT:", tokenId);
  } else {
    console.error("No DogMinted events found.");
    return;
  }

  const { nftMarketplace } = await hre.ignition.deploy(NftMarketplaceModule);
  console.log(`NFT Marketplace deployed to: ${nftMarketplace.address}`);

  console.log("Approving NFT for marketplace...");
  const approveHash = await basicNft.write.approve([
    nftMarketplace.address,
    tokenId,
  ]);
  await publicClient.waitForTransactionReceipt({ hash: approveHash });

  console.log("Listing NFT on marketplace...");
  const listItemHash = await nftMarketplace.write.listItem([
    basicNft.address,
    tokenId,
    PRICE,
  ]);
  await publicClient.waitForTransactionReceipt({ hash: listItemHash });
  console.log("NFT listed successfully on marketplace!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
