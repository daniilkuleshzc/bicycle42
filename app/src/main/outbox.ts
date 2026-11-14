// What a note sends to the agent (its prompt and its pictures), on disk until the note is done.
// A note waits in the app while the agent is on another one, and a failed one can be sent again:
// both must still have their pictures after the app is restarted.
//
//   <dir>/outbox/<hash of the note's id>.json
//
// The id is the page's own word, so it never becomes a file name itself.
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import type { PromptFile } from "../shared/types"

/** `id` is the message id the server knows it by, once it has been tried: a second try with the
 *  same id cannot queue the note twice. */
export type Outgoing = { text: string; files: PromptFile[]; id?: string }
export type Outbox = {
  /** False when it could not be written; the note still goes from memory. */
  save(id: string, payload: Outgoing): boolean
  read(id: string): Outgoing | undefined
  drop(id: string): void
}

export function createOutbox(dir: string, log: (level: "warn", msg: string, data?: unknown) => void = () => undefined): Outbox {
  const folder = path.join(dir, "outbox")
  const file = (id: string) => path.join(folder, `${crypto.createHash("sha1").update(id).digest("hex")}.json`)
  return {
    save(id, payload) {
      try {
        fs.mkdirSync(folder, { recursive: true })
        fs.writeFileSync(file(id), JSON.stringify(payload))
        return true
      } catch (err) {
        log("warn", "can't save what a note sends", String(err))
        return false
      }
    },
    read(id) {
      try {
        const raw: unknown = JSON.parse(fs.readFileSync(file(id), "utf8"))
        if (typeof raw !== "object" || raw === null) return undefined
        const { text, files, id: message } = raw as Record<string, unknown>
        if (typeof text !== "string" || !Array.isArray(files)) return undefined
        return { text, files: files as PromptFile[], ...(typeof message === "string" ? { id: message } : {}) }
      } catch {
        return undefined
      }
    },
    drop(id) {
      fs.rmSync(file(id), { force: true })
    },
  }
}
