import chai from "chai";
import chaiSubset from "chai-subset";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { ContractFactory, Signer, utils } from "ethers";
import { MigratableBusdTransmuterV2 } from "../../types/MigratableBUSDTransmuterV2";
import { YumAlpacaBusdVault } from "../../types/YumAlpacaBUSDVault";
import { WaBusdToken } from "../../types/WaBUSDToken";
import { Erc20Mock } from "../../types/Erc20Mock";
import { ZERO_ADDRESS } from "../utils/helpers";
import { VaultAdapterV2Mock } from "../../types/VaultAdapterV2Mock";
import { TransmuterV2AdapterWithIndirectionMock } from "../../types/TransmuterV2AdapterWithIndirectionMock";
const {parseEther, formatEther} = utils;

chai.use(solidity);
chai.use(chaiSubset);

const { expect } = chai;

let YumAlpacaVaultFactory: ContractFactory;
let AlUSDFactory: ContractFactory;
let ERC20MockFactory: ContractFactory;
let VaultAdapterV2MockFactory: ContractFactory;
let TransmuterFactory: ContractFactory;
let TransmuterAdapterV2MockFactory: ContractFactory;

describe("YumAlpacaVault:", () => {
  let signers: Signer[];

  before(async () => {
    YumAlpacaVaultFactory = await ethers.getContractFactory("YumAlpacaBUSDVault");
    TransmuterFactory = await ethers.getContractFactory("MigratableBUSDTransmuterV2");
    AlUSDFactory = await ethers.getContractFactory("WaBUSDToken");
    ERC20MockFactory = await ethers.getContractFactory("ERC20Mock");
    VaultAdapterV2MockFactory = await ethers.getContractFactory(
      "VaultAdapterV2Mock"
    );
    TransmuterAdapterV2MockFactory = await ethers.getContractFactory(
      "TransmuterV2AdapterWithIndirectionMock"
    );
  });

  beforeEach(async () => {
    signers = await ethers.getSigners();
  });

  describe("constructor", async () => {
    let deployer: Signer;
    let governance: Signer;
    let sentinel: Signer;
    let feeCollector: Signer;
    let token: Erc20Mock;
    let votingEscrow: Erc20Mock;
    let alUsd: WaBusdToken;
    let alchemist: YumAlpacaBusdVault;

    beforeEach(async () => {
      [deployer, governance, sentinel,feeCollector, ...signers] = signers;

      token = (await ERC20MockFactory.connect(deployer).deploy(
        "Mock DAI",
        "DAI",
        18
      )) as Erc20Mock;

      votingEscrow = (await ERC20MockFactory.connect(deployer).deploy(
        "veWasabi",
        "vWa",
        18
      )) as Erc20Mock;

      alUsd = (await AlUSDFactory.connect(deployer).deploy()) as WaBusdToken;
    });

    context("when governance is the zero address", () => {
      it("reverts", async () => {
        expect(
          YumAlpacaVaultFactory.connect(deployer).deploy(
            token.address,
            alUsd.address,
            votingEscrow.address,
            ZERO_ADDRESS,
            await sentinel.getAddress(),
            await feeCollector.getAddress()
          )
        ).revertedWith("YumAlpacaBUSDVault: governance address cannot be 0x0.");
      });
    });
  });

  describe("update Alchemist addys and variables", () => {
    let deployer: Signer;
    let governance: Signer;
    let newGovernance: Signer;
    let feeCollector: Signer;
    let rewards: Signer;
    let sentinel: Signer;
    let transmuter: Signer;
    let token: Erc20Mock;
    let votingEscrow: Erc20Mock;
    let alUsd: WaBusdToken;
    let alchemist: YumAlpacaBusdVault;

    beforeEach(async () => {
      [
        deployer,
        governance,
        newGovernance,
        rewards,
        sentinel,
        transmuter,
        feeCollector,
        ...signers
      ] = signers;

      token = (await ERC20MockFactory.connect(deployer).deploy(
        "Mock DAI",
        "DAI",
        18
      )) as Erc20Mock;

      votingEscrow = (await ERC20MockFactory.connect(deployer).deploy(
        "veWasabi",
        "vWa",
        18
      )) as Erc20Mock;

      alUsd = (await AlUSDFactory.connect(deployer).deploy()) as WaBusdToken;

      alchemist = (await YumAlpacaVaultFactory.connect(deployer).deploy(
        token.address,
        alUsd.address,
        votingEscrow.address,
        await governance.getAddress(),
        await sentinel.getAddress(),
        await feeCollector.getAddress()
      )) as YumAlpacaBusdVault;

    });

    describe("set governance", () => {
      context("when caller is not current governance", () => {
        beforeEach(() => (alchemist = alchemist.connect(deployer)));

        it("reverts", async () => {
          expect(
            alchemist.setPendingGovernance(await newGovernance.getAddress())
          ).revertedWith("YumAlpacaBUSDVault: only governance");
        });
      });

      context("when caller is current governance", () => {
        beforeEach(() => (alchemist = alchemist.connect(governance)));

        it("reverts when setting governance to zero address", async () => {
          expect(alchemist.setPendingGovernance(ZERO_ADDRESS)).revertedWith(
            "YumAlpacaBUSDVault: governance address cannot be 0x0."
          );
        });

        it("updates rewards", async () => {
          await alchemist.setRewards(await rewards.getAddress());
          expect(await alchemist.rewards()).equal(await rewards.getAddress());
        });
      });
    });

    describe("set transmuter", () => {
      context("when caller is not current governance", () => {
        it("reverts", async () => {
          expect(
            alchemist.setTransmuter(await transmuter.getAddress())
          ).revertedWith("YumAlpacaBUSDVault: only governance");
        });
      });

      context("when caller is current governance", () => {
        beforeEach(() => (alchemist = alchemist.connect(governance)));

        it("reverts when setting transmuter to zero address", async () => {
          expect(alchemist.setTransmuter(ZERO_ADDRESS)).revertedWith(
            "YumAlpacaBUSDVault: transmuter address cannot be 0x0."
          );
        });

        it("updates transmuter", async () => {
          await alchemist.setTransmuter(await transmuter.getAddress());
          expect(await alchemist.transmuter()).equal(
            await transmuter.getAddress()
          );
        });
      });
    });

    describe("set rewards", () => {
      context("when caller is not current governance", () => {
        beforeEach(() => (alchemist = alchemist.connect(deployer)));

        it("reverts", async () => {
          expect(alchemist.setRewards(await rewards.getAddress())).revertedWith(
            "YumAlpacaBUSDVault: only governance"
          );
        });
      });

      context("when caller is current governance", () => {
        beforeEach(() => (alchemist = alchemist.connect(governance)));

        it("reverts when setting rewards to zero address", async () => {
          expect(alchemist.setRewards(ZERO_ADDRESS)).revertedWith(
            "YumAlpacaBUSDVault: rewards address cannot be 0x0."
          );
        });

        it("updates rewards", async () => {
          await alchemist.setRewards(await rewards.getAddress());
          expect(await alchemist.rewards()).equal(await rewards.getAddress());
        });
      });
    });

    describe("set peformance fee", () => {
      context("when caller is not current governance", () => {
        beforeEach(() => (alchemist = alchemist.connect(deployer)));

        it("reverts", async () => {
          expect(alchemist.setHarvestFee(1)).revertedWith(
            "YumAlpacaBUSDVault: only governance"
          );
        });
      });

      context("when caller is current governance", () => {
        beforeEach(() => (alchemist = alchemist.connect(governance)));

        it("reverts when performance fee greater than maximum", async () => {
          const MAXIMUM_VALUE = await alchemist.PERCENT_RESOLUTION();
          expect(alchemist.setHarvestFee(MAXIMUM_VALUE.add(1))).revertedWith(
            "YumAlpacaBUSDVault: harvest fee above maximum"
          );
        });

        it("updates performance fee", async () => {
          await alchemist.setHarvestFee(1);
          expect(await alchemist.harvestFee()).equal(1);
        });
      });
    });

    describe("set collateralization limit", () => {
      context("when caller is not current governance", () => {
        beforeEach(() => (alchemist = alchemist.connect(deployer)));

        it("reverts", async () => {
          const collateralizationLimit = await alchemist.MINIMUM_COLLATERALIZATION_LIMIT();
          expect(
            alchemist.setCollateralizationLimit(collateralizationLimit)
          ).revertedWith("YumAlpacaBUSDVault: only governance");
        });
      });

      context("when caller is current governance", () => {
        beforeEach(() => (alchemist = alchemist.connect(governance)));

        it("reverts when performance fee less than minimum", async () => {
          const MINIMUM_LIMIT = await alchemist.MINIMUM_COLLATERALIZATION_LIMIT();
          expect(
            alchemist.setCollateralizationLimit(MINIMUM_LIMIT.sub(1))
          ).revertedWith("YumAlpacaBUSDVault: collateralization limit below minimum.");
        });

        it("reverts when performance fee greater than maximum", async () => {
          const MAXIMUM_LIMIT = await alchemist.MAXIMUM_COLLATERALIZATION_LIMIT();
          expect(
            alchemist.setCollateralizationLimit(MAXIMUM_LIMIT.add(1))
          ).revertedWith("YumAlpacaBUSDVault: collateralization limit above maximum");
        });

        it("updates collateralization limit", async () => {
          const collateralizationLimit = await alchemist.MINIMUM_COLLATERALIZATION_LIMIT();
          await alchemist.setCollateralizationLimit(collateralizationLimit);
          expect(await alchemist.collateralizationLimit()).containSubset([
            collateralizationLimit,
          ]);
        });
      });
    });
  });

  describe("vault actions", () => {
    let deployer: Signer;
    let governance: Signer;
    let sentinel: Signer;
    let feeCollector: Signer;
    let rewards: Signer;
    let transmuter: Signer;
    let minter: Signer;
    let user: Signer;
    let token: Erc20Mock;
    let votingEscrow: Erc20Mock;
    let alUsd: WaBusdToken;
    let alchemist: YumAlpacaBusdVault;
    let adapter: VaultAdapterV2Mock;
    let harvestFee = 1000;
    let pctReso = 10000;
    let transmuterContract: MigratableBusdTransmuterV2;
    let transVaultAdaptor: TransmuterV2AdapterWithIndirectionMock;

    beforeEach(async () => {
      [
        deployer,
        governance,
        sentinel,
        rewards,
        transmuter,
        minter,
        user,
        feeCollector,
        ...signers
      ] = signers;

      token = (await ERC20MockFactory.connect(deployer).deploy(
        "Mock DAI",
        "DAI",
        18
      )) as Erc20Mock;

      votingEscrow = (await ERC20MockFactory.connect(deployer).deploy(
        "veWasabo",
        "vWa",
        18
      )) as Erc20Mock;

      alUsd = (await AlUSDFactory.connect(deployer).deploy()) as WaBusdToken;

      alchemist = (await YumAlpacaVaultFactory.connect(deployer).deploy(
        token.address,
        alUsd.address,
        votingEscrow.address,
        await governance.getAddress(),
        await sentinel.getAddress(),
        await feeCollector.getAddress()
      )) as YumAlpacaBusdVault;

      await alchemist
        .connect(governance)
        .setTransmuter(await transmuter.getAddress());
      await alchemist
        .connect(governance)
        .setRewards(await rewards.getAddress());
      await alchemist.connect(governance).setHarvestFee(harvestFee);
      transmuterContract = (await TransmuterFactory.connect(deployer).deploy(
        alUsd.address,
        token.address,
        await governance.getAddress()
      )) as MigratableBusdTransmuterV2;

      transVaultAdaptor = (await TransmuterAdapterV2MockFactory.connect(deployer).deploy(
          token.address
        )) as TransmuterV2AdapterWithIndirectionMock;

      await alchemist.connect(governance).setTransmuter(transmuterContract.address);
      await transmuterContract.connect(governance).setWhitelist(alchemist.address, true);
      await transmuterContract.connect(governance).setActiveVault(transVaultAdaptor.address);
      await token.mint(await minter.getAddress(), parseEther("10000"));
      await token.connect(minter).approve(alchemist.address, parseEther("10000"));
    });

    describe("migrate", () => {
      beforeEach(async () => {
        adapter = (await VaultAdapterV2MockFactory.connect(deployer).deploy(
          token.address
        )) as VaultAdapterV2Mock;

        await alchemist.connect(governance).initialize(adapter.address);
      });

      context("when caller is not current governance", () => {
        beforeEach(() => (alchemist = alchemist.connect(deployer)));

        it("reverts", async () => {
          expect(alchemist.migrate(adapter.address)).revertedWith(
            "YumAlpacaBUSDVault: only governance"
          );
        });
      });

      context("when caller is current governance", () => {
        beforeEach(() => (alchemist = alchemist.connect(governance)));

        context("when adapter is zero address", async () => {
          it("reverts", async () => {
            expect(alchemist.migrate(ZERO_ADDRESS)).revertedWith(
              "YumAlpacaBUSDVault: active vault address cannot be 0x0."
            );
          });
        });

        context("when adapter token mismatches", () => {
          const tokenAddress = ethers.utils.getAddress(
            "0xffffffffffffffffffffffffffffffffffffffff"
          );

          let invalidAdapter: VaultAdapterV2Mock;

          beforeEach(async () => {
            invalidAdapter = (await VaultAdapterV2MockFactory.connect(
              deployer
            ).deploy(tokenAddress)) as VaultAdapterV2Mock;
          });

          it("reverts", async () => {
            expect(alchemist.migrate(invalidAdapter.address)).revertedWith(
              "YumAlpacaBUSDVault: token mismatch"
            );
          });
        });

        context("when conditions are met", () => {
          beforeEach(async () => {
            await alchemist.migrate(adapter.address);
          });

          it("increments the vault count", async () => {
            expect(await alchemist.vaultCount()).equal(2);
          });

          it("sets the vaults adapter", async () => {
            expect(await alchemist.getVaultAdapter(0)).equal(adapter.address);
          });
        });
      });
    });

    describe("flush funds", () => {
      let adapter: VaultAdapterV2Mock;

      context("when the Alchemist is not initialized", () => {
        it("reverts", async () => {
          expect(alchemist.flush()).revertedWith("YumAlpacaBUSDVault: not initialized.");
        });
      });

      context("when there is at least one vault to flush to", () => {
        context("when there is one vault", () => {
          let adapter: VaultAdapterV2Mock;
          let mintAmount = parseEther("5000");

          beforeEach(async () => {
            adapter = (await VaultAdapterV2MockFactory.connect(deployer).deploy(
              token.address
            )) as VaultAdapterV2Mock;
          });

          beforeEach(async () => {
            await token.mint(alchemist.address, mintAmount);

            await alchemist.connect(governance).initialize(adapter.address);

            await alchemist.flush();
          });

          it("flushes funds to the vault", async () => {
            expect(await token.balanceOf(adapter.address)).equal(mintAmount);
          });
        });

        context("when there are multiple vaults", () => {
          let inactiveAdapter: VaultAdapterV2Mock;
          let activeAdapter: VaultAdapterV2Mock;
          let mintAmount = parseEther("5000");

          beforeEach(async () => {
            inactiveAdapter = (await VaultAdapterV2MockFactory.connect(
              deployer
            ).deploy(token.address)) as VaultAdapterV2Mock;

            activeAdapter = (await VaultAdapterV2MockFactory.connect(
              deployer
            ).deploy(token.address)) as VaultAdapterV2Mock;

            await token.mint(alchemist.address, mintAmount);

            await alchemist
              .connect(governance)
              .initialize(inactiveAdapter.address);

            await alchemist.connect(governance).migrate(activeAdapter.address);

            await alchemist.flush();
          });

          it("flushes funds to the active vault", async () => {
            expect(await token.balanceOf(activeAdapter.address)).equal(
              mintAmount
            );
          });
        });
      });
    });

    describe("deposit and withdraw tokens", () => {
      let depositAmt = parseEther("5000");
      let mintAmt = parseEther("1000");
      let ceilingAmt = parseEther("10000");
      let collateralizationLimit = "2000000000000000000"; // this should be set in the deploy sequence
      beforeEach(async () => {
        adapter = (await VaultAdapterV2MockFactory.connect(deployer).deploy(
          token.address
        )) as VaultAdapterV2Mock;
        await alchemist.connect(governance).initialize(adapter.address);
        await alchemist
          .connect(governance)
          .setCollateralizationLimit(collateralizationLimit);
        await alUsd.connect(deployer).setWhitelist(alchemist.address, true);
        await alUsd.connect(deployer).setCeiling(alchemist.address, ceilingAmt);
        await token.mint(await minter.getAddress(), depositAmt);
        await token.connect(minter).approve(alchemist.address, parseEther("100000000"));
        await alUsd.connect(minter).approve(alchemist.address, parseEther("100000000"));
      });

      it("deposited amount is accounted for correctly", async () => {
        await alchemist.connect(minter).deposit(depositAmt);
        expect(
          await alchemist
            .connect(minter)
            .getCdpTotalDeposited(await minter.getAddress())
        ).equal(depositAmt);
      });

      it("deposits token and then withdraws all", async () => {
        let balBefore = await token.balanceOf(await minter.getAddress());
        await alchemist.connect(minter).deposit(depositAmt);
        await alchemist.connect(minter).withdraw(depositAmt);
        let balAfter = await token.balanceOf(await minter.getAddress());
        let feeAmount = depositAmt.mul(3).div(1000);
        expect(balAfter).equal(balBefore.sub(feeAmount));
        expect(await token.balanceOf(await feeCollector.getAddress())).equal(feeAmount);
      });

      it("reverts when withdrawing too much", async () => {
        let overdraft = depositAmt.add(parseEther("1000"));
        await alchemist.connect(minter).deposit(depositAmt);
        expect(alchemist.connect(minter).withdraw(overdraft)).revertedWith("ERC20: transfer amount exceeds balance");
      });

      it("reverts when cdp is undercollateralized", async () => {
        await alchemist.connect(minter).deposit(depositAmt);
        await alchemist.connect(minter).mint(mintAmt);
        expect(alchemist.connect(minter).withdraw(depositAmt)).revertedWith("Action blocked: unhealthy collateralization ratio");
      });

      it("deposits, mints, repays, and withdraws", async () => {
        let balBefore = await token.balanceOf(await minter.getAddress());
        await alchemist.connect(minter).deposit(depositAmt);
        await alchemist.connect(minter).mint(mintAmt);
        await alchemist.connect(minter).repay(0, mintAmt.mul(997).div(1000));
        await alchemist.connect(minter).withdraw(depositAmt.sub(mintAmt.mul(2).mul(3).div(1000)));
        let balAfter = await token.balanceOf(await minter.getAddress());
        let feeAmount = depositAmt.sub(mintAmt.mul(2).mul(3).div(1000)).mul(3).div(1000);
        expect(balAfter).equal(balBefore.sub(depositAmt).add(depositAmt.sub(mintAmt.mul(2).mul(3).div(1000))).sub(feeAmount));
        expect(await token.balanceOf(await feeCollector.getAddress())).equal(feeAmount);
      });

      it("deposits 5000 DAI, mints 1000 alUSD, and withdraws 3000 DAI", async () => {
        let withdrawAmt = depositAmt.sub(mintAmt.mul(2));
        await alchemist.connect(minter).deposit(depositAmt);
        await alchemist.connect(minter).mint(mintAmt);
        await alchemist.connect(minter).withdraw(withdrawAmt);

        let feeAmount = withdrawAmt.mul(3).div(1000);
        expect(await token.balanceOf(await minter.getAddress())).equal(
          parseEther("13000").sub(feeAmount)
        );
        expect(await token.balanceOf(await feeCollector.getAddress())).equal(feeAmount);

      });

      describe("flushActivator", async () => {
        beforeEach(async () => {
          await token.connect(deployer).approve(alchemist.address, parseEther("1"));
          await token.mint(await deployer.getAddress(), parseEther("1"));
          await token.mint(await minter.getAddress(), parseEther("100000"));
          await alchemist.connect(deployer).deposit(parseEther("1"));
        });

        it("deposit() flushes funds if amount >= flushActivator", async () => {
          let balBeforeWhale = await token.balanceOf(adapter.address);
          await alchemist.connect(minter).deposit(parseEther("100000"));
          let balAfterWhale = await token.balanceOf(adapter.address);
          expect(balBeforeWhale).equal(0);
          expect(balAfterWhale).equal(parseEther("100001"));
        });

        it("deposit() does not flush funds if amount < flushActivator", async () => {
          let balBeforeWhale = await token.balanceOf(adapter.address);
          await alchemist.connect(minter).deposit(parseEther("99999"));
          let balAfterWhale = await token.balanceOf(adapter.address);
          expect(balBeforeWhale).equal(0);
          expect(balAfterWhale).equal(0);
        });
      })
    });

    describe("repay and liquidate tokens", () => {
      let depositAmt = parseEther("5000");
      let mintAmt = parseEther("1000");
      let ceilingAmt = parseEther("10000");
      let collateralizationLimit = "2000000000000000000"; // this should be set in the deploy sequence
      beforeEach(async () => {
        adapter = (await VaultAdapterV2MockFactory.connect(deployer).deploy(
          token.address
        )) as VaultAdapterV2Mock;
        await alchemist.connect(governance).initialize(adapter.address);
        await alchemist
          .connect(governance)
          .setCollateralizationLimit(collateralizationLimit);
        await alUsd.connect(deployer).setWhitelist(alchemist.address, true);
        await alUsd.connect(deployer).setCeiling(alchemist.address, ceilingAmt);
        await token.mint(await minter.getAddress(), ceilingAmt);
        await token.connect(minter).approve(alchemist.address, ceilingAmt);
        await alUsd.connect(minter).approve(alchemist.address, parseEther("100000000"));
        await token.connect(minter).approve(transmuterContract.address, ceilingAmt);
        await alUsd.connect(minter).approve(transmuterContract.address, depositAmt);
      });
      it("repay with dai reverts when nothing is minted and transmuter has no alUsd deposits", async () => {
        await alchemist.connect(minter).deposit(depositAmt.sub(parseEther("1000")))
        expect(alchemist.connect(minter).repay(mintAmt, 0)).revertedWith("SafeMath: subtraction overflow")
      })
      it("liquidate max amount possible if trying to liquidate too much", async () => {
        let liqAmt = depositAmt;
        let balBefore = await token.balanceOf(await minter.getAddress());
        await alchemist.connect(minter).deposit(depositAmt);
        await alchemist.connect(minter).mint(mintAmt);

        let actuallyGetAmount = mintAmt.mul(997).div(1000);

        await transmuterContract.connect(minter).stake(actuallyGetAmount);
        await alchemist.connect(minter).liquidate(liqAmt);
        const transBal = await token.balanceOf(transmuterContract.address);
        expect(transBal).equal(mintAmt);
      })
      it("liquidates funds from vault if not enough in the buffer", async () => {
        let balBefore = await token.balanceOf(await minter.getAddress());
        let liqAmt = parseEther("600");
        await alchemist.connect(minter).deposit(depositAmt); //5000
        await alchemist.connect(governance).flush();
        await alchemist.connect(minter).deposit(mintAmt.div(2)); //500
        await alchemist.connect(minter).mint(mintAmt);

        let actuallyGetAmount = mintAmt.mul(997).div(1000);

        await transmuterContract.connect(minter).stake(actuallyGetAmount);
        const alchemistTokenBalPre = await token.balanceOf(alchemist.address);
        await alchemist.connect(minter).liquidate(liqAmt);
        const alchemistTokenBalPost = await token.balanceOf(alchemist.address);
        console.log("pre", alchemistTokenBalPre.toString(), alchemistTokenBalPost.toString())
        const transmuterEndingTokenBal = await token.balanceOf(transmuterContract.address);
        expect(alchemistTokenBalPost).equal(0);
        expect(transmuterEndingTokenBal).equal(liqAmt);
      })
      it("liquidates the minimum necessary from the alchemist buffer", async () => {
        let balBefore = await token.balanceOf(await minter.getAddress());
        let dep2Amt = parseEther("500");
        let liqAmt = parseEther("200");
        await alchemist.connect(minter).deposit(parseEther("2000"));
        await alchemist.connect(governance).flush();
        await alchemist.connect(minter).deposit(dep2Amt);
        await alchemist.connect(minter).mint(parseEther("1000"));

        let actuallyGetAmount = parseEther("1000").mul(997).div(1000);

        await transmuterContract.connect(minter).stake(actuallyGetAmount);
        const alchemistTokenBalPre = await token.balanceOf(alchemist.address);
        await alchemist.connect(minter).liquidate(liqAmt);
        const alchemistTokenBalPost = await token.balanceOf(alchemist.address);

        const transmuterEndingTokenBal = await token.balanceOf(transmuterContract.address);
        expect(alchemistTokenBalPost).equal(dep2Amt.sub(liqAmt));
        expect(transmuterEndingTokenBal).equal(liqAmt);
      })
      it("deposits, mints alUsd, repays, and has no outstanding debt", async () => {
        await alchemist.connect(minter).deposit(depositAmt.sub(parseEther("1000")));
        await alchemist.connect(minter).mint(mintAmt);

        let actuallyGetAmount = mintAmt.mul(997).div(1000);

        await transmuterContract.connect(minter).stake(actuallyGetAmount);

        await alchemist.connect(minter).repay(mintAmt, 0);
        expect(await alchemist.connect(minter).getCdpTotalDebt(await minter.getAddress())).equal(0)
      })
      it("deposits, mints, repays, and has no outstanding debt", async () => {
        await alchemist.connect(minter).deposit(depositAmt);
        await alchemist.connect(minter).mint(mintAmt);

        let actuallyGetAmount = mintAmt.mul(997).div(1000);

        await alchemist.connect(minter).repay(0, actuallyGetAmount);
        expect(
          await alchemist
            .connect(minter)
            .getCdpTotalDebt(await minter.getAddress())
        ).equal(mintAmt.mul(3).div(1000));
      });
      it("deposits, mints alUsd, repays with alUsd and DAI, and has no outstanding debt", async () => {
        await alchemist.connect(minter).deposit(depositAmt.sub(parseEther("1000")));
        await alchemist.connect(minter).mint(mintAmt);

        let actuallyGetAmount = mintAmt.mul(997).div(1000);

        await transmuterContract.connect(minter).stake(parseEther("499"));
        await alchemist.connect(minter).repay(parseEther("502"), parseEther("498"));
        expect(await alchemist.connect(minter).getCdpTotalDebt(await minter.getAddress())).equal(0)
      })

      it("deposits and liquidates DAI", async () => {
        let balBefore = await token.balanceOf(await minter.getAddress());
        await alchemist.connect(minter).deposit(depositAmt);
        await alchemist.connect(minter).mint(mintAmt);

        let actuallyGetAmount = mintAmt.mul(997).div(1000);

        await transmuterContract.connect(minter).stake(actuallyGetAmount);
        await alchemist.connect(minter).liquidate(mintAmt);
        expect( await alchemist.connect(minter).getCdpTotalDeposited(await minter.getAddress())).equal(depositAmt.sub(mintAmt))
      });
    });

    describe("mint", () => {
      let depositAmt = parseEther("5000");
      let mintAmt = parseEther("1000");
      let ceilingAmt = parseEther("1000");

      beforeEach(async () => {
        adapter = (await VaultAdapterV2MockFactory.connect(deployer).deploy(
          token.address
        )) as VaultAdapterV2Mock;

        await alchemist.connect(governance).initialize(adapter.address);

        await alUsd.connect(deployer).setCeiling(alchemist.address, ceilingAmt);
        await token.mint(await minter.getAddress(), depositAmt);
        await token.connect(minter).approve(alchemist.address, depositAmt);
      });

      it("reverts if the Alchemist is not whitelisted", async () => {
        await alchemist.connect(minter).deposit(depositAmt);
        expect(alchemist.connect(minter).mint(mintAmt)).revertedWith(
          "waBUSD: Alchemist is not whitelisted"
        );
      });

      context("is whiltelisted", () => {
        beforeEach(async () => {
          await alUsd.connect(deployer).setWhitelist(alchemist.address, true);
        });

        it("reverts if the Alchemist is blacklisted", async () => {

          await alUsd.connect(deployer).setBlacklist(alchemist.address);
          await alchemist.connect(minter).deposit(depositAmt);
          expect(alchemist.connect(minter).mint(mintAmt)).revertedWith(
            "waBUSD: Alchemist is blacklisted"
          );
        });

        it("reverts when trying to mint too much", async () => {
          expect(alchemist.connect(minter).mint(parseEther("2000"))).revertedWith(
            "Loan-to-value ratio breached"
          );
        });

        it("reverts if the ceiling was breached", async () => {
          let lowCeilingAmt = parseEther("100");
          await alUsd
            .connect(deployer)
            .setCeiling(alchemist.address, lowCeilingAmt);
          await alchemist.connect(minter).deposit(depositAmt);
          expect(alchemist.connect(minter).mint(mintAmt)).revertedWith(
            "waBUSD: Alchemist's ceiling was breached"
          );
        });

        it("mints successfully to depositor", async () => {
          let balBefore = await token.balanceOf(await minter.getAddress());
          await alchemist.connect(minter).deposit(depositAmt);
          await alchemist.connect(minter).mint(mintAmt);
          let balAfter = await token.balanceOf(await minter.getAddress());

          expect(balAfter).equal(balBefore.sub(depositAmt));

          let fee = mintAmt.mul(3).div(1000);
          expect(await alUsd.balanceOf(await minter.getAddress())).equal(mintAmt.sub(fee));
          expect(await alUsd.balanceOf(await feeCollector.getAddress())).equal(fee);
        });
      });
    });

    describe("harvest", () => {
      let depositAmt = parseEther("5000");
      let mintAmt = parseEther("1000");
      let stakeAmt = mintAmt.div(2);
      let ceilingAmt = parseEther("10000");
      let yieldAmt = parseEther("100");

      beforeEach(async () => {
        adapter = (await VaultAdapterV2MockFactory.connect(deployer).deploy(
          token.address
        )) as VaultAdapterV2Mock;

        await alUsd.connect(deployer).setWhitelist(alchemist.address, true);
        await alchemist.connect(governance).initialize(adapter.address);
        await alUsd.connect(deployer).setCeiling(alchemist.address, ceilingAmt);
        await token.mint(await user.getAddress(), depositAmt);
        await token.connect(user).approve(alchemist.address, depositAmt);
        await alUsd.connect(user).approve(transmuterContract.address, depositAmt);
        await alchemist.connect(user).deposit(depositAmt);
        await alchemist.connect(user).mint(mintAmt);
        await transmuterContract.connect(user).stake(stakeAmt);
        await alchemist.flush();
      });

      it("harvests yield from the vault", async () => {
        await token.mint(adapter.address, yieldAmt);
        await alchemist.harvest(0);
        let transmuterBal = await token.balanceOf(transmuterContract.address);
        expect(transmuterBal).equal(yieldAmt.sub(yieldAmt.div(pctReso/harvestFee)));
        let vaultBal = await token.balanceOf(adapter.address);
        expect(vaultBal).equal(depositAmt);
      })

      it("sends the harvest fee to the rewards address", async () => {
        await token.mint(adapter.address, yieldAmt);
        await alchemist.harvest(0);
        let rewardsBal = await token.balanceOf(await rewards.getAddress());
        expect(rewardsBal).equal(yieldAmt.mul(100).div(harvestFee));
      })

      it("does not update any balances if there is nothing to harvest", async () => {
        let initTransBal = await token.balanceOf(transmuterContract.address);
        let initRewardsBal = await token.balanceOf(await rewards.getAddress());
        await alchemist.harvest(0);
        let endTransBal = await token.balanceOf(transmuterContract.address);
        let endRewardsBal = await token.balanceOf(await rewards.getAddress());
        expect(initTransBal).equal(endTransBal);
        expect(initRewardsBal).equal(endRewardsBal);
      })
    })
  });
});
