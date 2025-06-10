# Brandmeister Protector
## Purpose
You can specify RadioIDs which are not allowed to subscribe new TGs on a named Slot.
If the pirate tries to subscribe to a dynamic TG, ALL dynamic TGs from this Slot are dropped immediately. (Dropping only he one which is subscribed isn't possible atm)

## HowTo
- install [bun](https://bun.sh/) on your Machine
- `git clone git@github.com:int2001/bm_pirateban.git` the repo
- change to the directory which was created (`cd bm_pirateban`)
- install dependencies by calling `bun i`
- rename the `config.js.sample` to `config.js`
- edit the `config.js` (Selfdescribing)
- start the tool with `bun ./index.js`
- enjoy

## Important
if you want to use it on your repeater, i'd recommend a dedicated server (Raspberry fits) for it.
Furthermore i'd appreciate some mention for the tool. Something like "Protection by DJ7NT"...
