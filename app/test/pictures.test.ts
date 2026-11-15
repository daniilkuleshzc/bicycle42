// The conversation's pictures by address (src/main/pictures.ts): what the window's <img> gets
// for a `b42-img:` URL.
import assert from "node:assert/strict"
import { test } from "node:test"
import { createPictures, type PictureSource } from "../src/main/pictures"

const b64 = (text: string) => Buffer.from(text).toString("base64")
const body = async (r: Response) => Buffer.from(await r.arrayBuffer()).toString()

test("a named picture is served from the bytes it was named with, decoded once; the type is the message's", async () => {
  const fetched: PictureSource[] = []
  const pictures = createPictures({ fetch: async (src) => (fetched.push(src), undefined) })
  const url = pictures.name({ session: "ses_1", message: "msg_A", file: 2 }, "image/jpeg", b64("area"))
  assert.equal(url, "b42-img://pic/ses_1/msg_A/2")
  for (let i = 0; i < 3; i++) {
    const r = await pictures.serve(url)
    assert.equal(r.status, 200)
    assert.equal(r.headers.get("content-type"), "image/jpeg")
    assert.match(r.headers.get("cache-control") ?? "", /immutable/)
    assert.equal(await body(r), "area")
  }
  assert.deepEqual(fetched, [], "never asked the server")
})

test("a picture named without its bytes, or no longer kept, comes from the app's own file, else from the server", async () => {
  const fetched: string[] = []
  const pictures = createPictures({
    fetch: async (src) => (fetched.push(src.message), { mime: "image/png", data: b64(`server ${src.message}`) }),
    local: async (src) => (src.message === "msg_note" && src.file === 0 ? Buffer.from("from disk") : undefined),
    maxBytes: 20,
  })
  const note = pictures.name({ session: "s", message: "msg_note", file: 0 }, "image/jpeg")
  const other = pictures.name({ session: "s", message: "msg_other", file: 1 }, "image/png")
  assert.equal(await body(await pictures.serve(note)), "from disk")
  assert.equal(await body(await pictures.serve(other)), "server msg_other")
  // Two looks at once make one trip.
  const big = pictures.name({ session: "s", message: "msg_big", file: 0 }, "image/png")
  const [a, b] = await Promise.all([pictures.serve(big), pictures.serve(big)])
  assert.deepEqual([await body(a), await body(b)], ["server msg_big", "server msg_big"])
  assert.deepEqual(fetched, ["msg_other", "msg_big"])
  // The cache holds 20 bytes: "server msg_other" (16) went when "server msg_big" (14) came.
  assert.equal(await body(await pictures.serve(other)), "server msg_other")
  assert.deepEqual(fetched, ["msg_other", "msg_big", "msg_other"])
})

test("anything not named is refused: other addresses, other hosts and schemes, a path out, a type that is not a picture", async () => {
  const pictures = createPictures({ fetch: async () => ({ mime: "image/jpeg", data: b64("x") }) })
  const ok = pictures.name({ session: "ses_1", message: "msg_A", file: 0 }, "image/jpeg", b64("x"))
  const html = pictures.name({ session: "ses_1", message: "msg_A", file: 1 }, "text/html", b64("<script>"))
  assert.equal((await pictures.serve(ok)).status, 200)
  for (const url of [
    "b42-img://pic/ses_1/msg_A/1",
    "b42-img://pic/ses_1/msg_A/3",
    "b42-img://pic/ses_2/msg_A/0",
    "b42-img://pic/ses_1/msg_A/0/..",
    "b42-img://pic/../../etc/passwd",
    "b42-img://pic/ses_1/msg_A/0?x=1",
    "b42-img://other/ses_1/msg_A/0",
    "file:///etc/passwd",
    "https://pic/ses_1/msg_A/0",
    "b42-img://pic/",
    "not a url",
    html,
  ])
    assert.ok([400, 404].includes((await pictures.serve(url)).status), url)
  pictures.clear()
  assert.equal((await pictures.serve(ok)).status, 404, "forgotten with another server")
})

test("ids with odd characters are one path segment each", async () => {
  const pictures = createPictures({ fetch: async () => undefined })
  const url = pictures.name({ session: "ses/1", message: "msg A?#", file: 0 }, "image/jpeg", b64("odd"))
  assert.equal(url, "b42-img://pic/ses%2F1/msg%20A%3F%23/0")
  assert.equal(await body(await pictures.serve(url)), "odd")
})
