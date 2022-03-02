import * as error from "./error";

describe("ManyError", function () {
  it("replaces fields", () => {
    const omniError = {
      [0]: 123,
      [1]: "Hello {0} and {2}.",
      [2]: {
        "0": "ZERO",
        "1": "ONE",
        "2": "TWO",
      },
    };
    const err = new error.ManyError(omniError);

    expect(err.toString()).toBe("Error: Hello ZERO and TWO.");
  });

  it("works with double brackets", () => {
    const omniError = {
      [0]: 123,
      [1]: "/{{}}{{{0}}}{{{a}}}{b}}}{{{2}.",
      [2]: {
        "0": "ZERO",
        "1": "ONE",
        "2": "TWO",
      },
    };
    const err = new error.ManyError(omniError);

    expect(err.toString()).toBe("Error: /{}{ZERO}{}}{TWO.");
  });
});
