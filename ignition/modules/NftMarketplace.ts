import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const NftMarketplaceModule = buildModule("NftMarketplaceModule", (m) => {
  const deployer = m.getAccount(0);

  const nftMarketplace = m.contract("NftMarketplace", [], {
    from: deployer,
  });

  return { nftMarketplace };
});

export default NftMarketplaceModule;
