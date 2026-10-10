import { loginAction } from './server/actions/auth';
async function run() {
  const res = await loginAction({ email: "demo@bellabooks.test", password: "badpassword" });
  console.log("RESULT:", res);
}
run();
