import { transactionTypeIndices } from "../../../const"
import { Address } from "../../../identity"
import { Message } from "../../../message"
import { CborMap } from "../../../message/cbor"
import {
  getAddressFromTaggedIdentity,
  getTxnTypeNameFromIndices,
  makeLedgerSendParam,
  makeTxnData,
} from "../../../utils"
import { Transaction } from "../ledger"
import {
  AccountFeature,
  AccountFeatureTypes,
  AccountInfoPayloadResponseLabels,
  AccountMultisigArgument,
  LedgerSendParam,
  LedgerTransactionType,
  NetworkModule,
  TransactionTypeIndices,
} from "../types"

type GetAccountInfoReturnType = ReturnType<typeof getAccountInfo>
type GetMultisigTokenReturnType = ReturnType<typeof getMultisigToken>
type SubmitMultisigTxnData = LedgerSendParam & { memo?: string }

export interface Account extends NetworkModule {
  info: (accountId: string) => Promise<GetAccountInfoReturnType>
  submitMultisigTxn: (
    txnType: LedgerTransactionType,
    txnData: SubmitMultisigTxnData,
  ) => Promise<GetMultisigTokenReturnType>
  multisigInfo: (token: ArrayBuffer) => Promise<unknown>
}

export type AccountInfoData = {
  name: string
  roles: ReturnType<typeof getAccountInfoRolesData>
  features: ReturnType<typeof getAccountInfoFeaturesData>
}

export type MultisigTransactionInfo = {
  memo?: string
  transaction?: Omit<Transaction, "id" | "time">
  submitter: string
  approvers: { address: string; hasApproved: boolean }[]
  threshold: number
  execute_automatically: boolean
  timeout: Date
  cborData?: CborMap
}

export const Account: Account = {
  _namespace_: "account",

  async info(accountId: string): Promise<GetAccountInfoReturnType> {
    const message = await this.call("account.info", new Map([[0, accountId]]))
    return getAccountInfo(message)
  },

  async submitMultisigTxn(
    txnType: LedgerTransactionType,
    txnData: SubmitMultisigTxnData,
  ): Promise<GetMultisigTokenReturnType> {
    const m = new Map()
    m.set(0, txnData.from)
    txnData?.memo && m.set(1, txnData.memo)
    m.set(2, makeSubmittedTxnData(txnType, txnData))
    const msg = await this.call("account.multisigSubmitTransaction", m)
    return getMultisigToken(msg)
  },

  async multisigInfo(token: ArrayBuffer) {
    const res = await this.call("account.multisigInfo", new Map([[0, token]]))
    return await getMultisigTxnData(res)
  },
}

async function getMultisigTxnData(msg: Message) {
  const result: { info: MultisigTransactionInfo | undefined } = {
    info: undefined,
  }
  const content = msg.getPayload()
  if (content) {
    try {
      result.info = {
        memo: content.get(0),
        transaction: await makeTxnData(content.get(1) as Map<number, unknown>, {
          isTxnParamData: true,
        }),
        submitter: await getAddressFromTaggedIdentity(
          content.get(2) as { value: Uint8Array },
        ),
        approvers: await Promise.all(
          Array.from(content.get(3)).map(async approver => {
            const [identity, hasApproved] = approver as [
              { value: Uint8Array },
              Map<number, boolean>,
            ]
            const address = await getAddressFromTaggedIdentity(identity)
            return {
              address,
              hasApproved: hasApproved.get(0)!,
            }
          }),
        ),
        threshold: content.get(4),
        execute_automatically: content.get(5),
        timeout: content.get(6),
        cborData: content.get(7),
      }
    } catch (e) {
      console.error("error in multisig txn data:", e)
    }
  }
  return result
}

function getMultisigToken(msg: Message) {
  const res: { token: ArrayBuffer | undefined } = {
    token: undefined,
  }
  const decoded = msg.getPayload()
  if (decoded) {
    res.token = decoded.get(0)
  }
  return res
}

function makeSubmittedTxnData(
  txnType: LedgerTransactionType,
  txnData: SubmitMultisigTxnData,
) {
  const accountMultisigTxn = new Map()
  let txnTypeIndices
  let txnParam
  if (txnType === LedgerTransactionType.send) {
    txnTypeIndices = transactionTypeIndices[LedgerTransactionType.send]
    txnParam = makeLedgerSendParam(txnData)
  }
  if (txnTypeIndices && txnParam) {
    accountMultisigTxn.set(0, txnTypeIndices)
    accountMultisigTxn.set(1, txnParam)
    return accountMultisigTxn
  }
  throw new Error(`transaction type not yet implemented: ${txnType}`)
}

function getAccountInfo(message: Message): {
  accountInfo: AccountInfoData | undefined
} {
  let result: { accountInfo: AccountInfoData | undefined } = {
    accountInfo: undefined,
  }
  const payload = message.getPayload()
  if (payload instanceof Map) {
    result.accountInfo = {
      name: payload.get(AccountInfoPayloadResponseLabels.name),
      roles: getAccountInfoRolesData(
        payload?.get?.(AccountInfoPayloadResponseLabels.roles),
      ),
      features: getAccountInfoFeaturesData(
        payload?.get?.(AccountInfoPayloadResponseLabels.features),
      ),
    }
  }
  return result
}

function getAccountInfoRolesData(
  roles: Map<{ value: Uint8Array }, string[]> = new Map(),
): Map<string, string[]> | undefined {
  return Array.from(roles).reduce((acc, roleData) => {
    const [identity, roleList] = roleData
    const i = identity as { value: Uint8Array }
    const address = new Address(Buffer.from(i.value)).toString()
    acc.set(address, roleList)
    return acc
  }, new Map())
}

function getAccountInfoFeaturesData(
  features: AccountFeature[] = [],
): Map<AccountFeatureTypes, boolean | unknown> {
  return features.reduce((acc, feature) => {
    let featureName
    let featureValue
    let featureLabelNum
    if (Array.isArray(feature)) {
      const [featureLabelNum, featureArguments] = feature as [number, unknown]
      featureName = AccountFeatureTypes[featureLabelNum]
      featureValue = makeAccountFeatureArgumentData(
        featureLabelNum,
        featureArguments as Map<number, unknown>,
      )
    } else if (typeof feature === "number") {
      featureLabelNum = feature
      featureName = AccountFeatureTypes[feature]
      featureValue = true
    }
    if (!featureName && featureLabelNum)
      console.error("Account feature not implemented:", featureLabelNum)
    if (featureName && featureValue) acc.set(featureName, featureValue)
    return acc
  }, new Map())
}

function makeAccountFeatureArgumentData(
  feature: number,
  argumentData: Map<number, unknown> = new Map(),
): Map<AccountMultisigArgument, unknown> | undefined {
  if (feature === AccountFeatureTypes.accountMultisig) {
    return Array.from(argumentData).reduce((acc, argData) => {
      const [argLabelNum, value] = argData
      const argName = AccountMultisigArgument[argLabelNum]
      if (!argName) {
        console.error(
          "Account multisig feature argument not found:",
          argLabelNum,
        )
        return acc
      } else acc.set(argName, value)
      return acc
    }, new Map())
  }
}
