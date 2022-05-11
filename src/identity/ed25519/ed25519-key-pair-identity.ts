import forge, { pki } from "node-forge"
import * as bip39 from "bip39"
import { CoseKey } from "../../message/cose"
const ed25519 = pki.ed25519
import { KeyPairIdentity } from "../types"

export class Ed25519KeyPairIdentity extends KeyPairIdentity {
  publicKey: ArrayBuffer
  privateKey: ArrayBuffer

  constructor(publicKey: ArrayBuffer, privateKey: ArrayBuffer) {
    super()
    this.publicKey = publicKey
    this.privateKey = privateKey
  }

  static getMnemonic(): string {
    return bip39.generateMnemonic()
  }

  static fromMnemonic(mnemonic: string): Ed25519KeyPairIdentity {
    const sanitized = mnemonic.trim().split(/\s+/g).join(" ")
    if (!bip39.validateMnemonic(sanitized)) {
      throw new Error("Invalid Mnemonic")
    }
    const seed = bip39.mnemonicToSeedSync(sanitized).slice(0, 32)
    const keys = ed25519.generateKeyPair({ seed })
    return new Ed25519KeyPairIdentity(keys.publicKey, keys.privateKey)
  }

  static fromPem(pem: string): Ed25519KeyPairIdentity {
    try {
      const der = forge.pem.decode(pem)[0].body
      const asn1 = forge.asn1.fromDer(der.toString())
      const { privateKeyBytes } = ed25519.privateKeyFromAsn1(asn1)
      const keys = ed25519.generateKeyPair({ seed: privateKeyBytes })
      return new Ed25519KeyPairIdentity(keys.publicKey, keys.privateKey)
    } catch (e) {
      throw new Error("Invalid PEM")
    }
  }

  async sign(data: ArrayBuffer): Promise<ArrayBuffer> {
    return ed25519.sign({
      message: data as Uint8Array,
      privateKey: this.privateKey as Uint8Array,
    })
  }
  async verify(m: ArrayBuffer): Promise<boolean> {
    return false
  }

  getCoseKey(): CoseKey {
    const c = new Map()
    c.set(1, 1) // kty: OKP
    c.set(3, -8) // alg: EdDSA
    c.set(-1, 6) // crv: Ed25519
    c.set(4, [2]) // key_ops: [verify]
    c.set(-2, this.publicKey) // x: publicKey
    return new CoseKey(c)
  }

  toJson() {
    return {
      publicKey: this.publicKey,
      privateKey: this.privateKey,
    }
  }
}
