import { keysForKeyset } from "./keysets.ts";

Deno.test("aggregate registry selects USR.AC signing keys with exact identity and environment", () => {
  const expected = { kty: "EC", kid: "urn:ca:bc:sdx:org:usr.ac:apstst:0" };
  const keys = [
    expected,
    { kty: "EC", kid: "urn:ca:bc:sdx:org:usr.ac:apsdev:0" },
    { kty: "EC", kid: "urn:ca:bc:sdx:org:usr.acme:apstst:0" },
    { kty: "EC", kid: "urn:ca:bc:sdx:sys:usr.ac.toys:apstst:0" },
    { kty: "EC" },
  ];
  const actual = keysForKeyset(keys, "sdx.org.usr.ac", "apstst");
  if (actual.length !== 1 || actual[0] !== expected) {
    throw new Error("Expected only the USR.AC APSTST organization key");
  }
});
