# Many Library

This library can be used by JavaScript applications to connect to networks that
support the Many Protocol.

## Usage

Generating key pairs.

```ts
KeyPair.fromSeedWords(string) // => KeyPair
KeyPair.fromPem(string) // => KeyPair
```

Managing identities.

```ts
identity = Address.fromPublicKey(key) // => Address
identity = Address.fromString(string) // => Address
anonymous = new Address() // => Anonymous Address

identity.toString(keys) // => "mw7aekyjtsx2hmeadrua5cpitgy7pykjkok3gyth3ggsio4zwa"
identity.toHex(keys) // => "01e736fc9624ff8ca7956189b6c1b66f55f533ed362ca48c884cd20065";
```

Encoding and decoding messages.

```ts
msg = { to, from, method, data, timestamp, version }

message = Message.fromObject(msg) // Message
message.toCborData() // => Anonymous CBOR Buffer
message.toCborData(keys) // => Signed CBOR Buffer

message.content // => Object
```

Sending and receiving messages from a network.

```ts
network = new Network(url, keys)

network.sendEncoded(cbor) // => Encoded Response
network.send(msg) // => Decoded Response

network.base.endpoints() // => Decoded and Parsed Response
network.ledger.info() // => Decoded and Parsed Response
```

## Account

### create

```ts
import { Network, Account } from "many-js"

const network = new Network("/api", identity)
network.apply([Account])

const roles = new Map().set("ma123....", [
  AccountRole[AccountRole.canMultisigApprove],
  AccountRole[AccountRole.canMultisigSubmit],
])

const features = [
  AccountFeatureTypes[AccountFeatureTypes.accountLedger],
  [
    AccountFeatureTypes[AccountFeatureTypes.accountMultisig],
    new Map()
      .set(AccountMultisigArgument.threshold, 2)
      .set(AccountMultisigArgument.expireInSecs, 3600)
      .set(AccountMultisigArgument.executeAutomatically, 0),
  ],
]
await network.account.create("account name", roles, features)
```
