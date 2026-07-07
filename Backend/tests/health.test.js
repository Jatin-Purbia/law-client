const request = require("supertest");
const app = require("../app");

describe("Health API", () => {
  test("GET /health should return 200", async () => {
    const res = await request(app).get("/health");

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("OK");
    expect(res.body.database).toBeDefined();
  });
});