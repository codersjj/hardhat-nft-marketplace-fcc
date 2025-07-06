import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const BasicNftModule = buildModule("BasicNft", (m) => {
  const deployer = m.getAccount(0);

  const basicNft = m.contract("BasicNft", [], {
    from: deployer,
  });

  return { basicNft };
});

export default BasicNftModule;
