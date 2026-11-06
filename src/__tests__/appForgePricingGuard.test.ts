import {describe,it,expect} from "vitest";
import {assertAppForgePrice, MONTHLY_PLAN_USD_CENTS, TOPUP_USD_CENTS} from "../services/appForgePricePolicy.js";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

const monthly={active:true,currency:"usd",type:"recurring",unit_amount:4900,recurring:{interval:"month",interval_count:1},livemode:true};
const credit={active:true,currency:"usd",type:"one_time",unit_amount:5000,recurring:null,livemode:true};

describe("AppForge margin-protective checkout terms",()=>{
 it("only accepts exact published USD monthly subscription prices",()=>{
  expect(()=>assertAppForgePrice(monthly,MONTHLY_PLAN_USD_CENTS.starter,"recurring",true)).not.toThrow();
  expect(()=>assertAppForgePrice({...monthly,unit_amount:1900},4900,"recurring",true)).toThrow(/checkout paused/);
  expect(()=>assertAppForgePrice({...monthly,currency:"nzd"},4900,"recurring",true)).toThrow(/checkout paused/);
  expect(()=>assertAppForgePrice({...monthly,recurring:{interval:"year",interval_count:1}},4900,"recurring",true)).toThrow(/checkout paused/);
  expect(()=>assertAppForgePrice({...monthly,livemode:false},4900,"recurring",true)).toThrow(/checkout paused/);
  expect(()=>assertAppForgePrice({...monthly,active:false},4900,"recurring",true)).toThrow(/checkout paused/);
 });
 it("prevents credit top-ups billed as subscriptions, discounted or inactive prices",()=>{
  expect(()=>assertAppForgePrice(credit,TOPUP_USD_CENTS[50],"one_time",true)).not.toThrow();
  expect(()=>assertAppForgePrice({...credit,unit_amount:100},5000,"one_time",true)).toThrow(/checkout paused/);
  expect(()=>assertAppForgePrice({...credit,type:"recurring"},5000,"one_time",true)).toThrow(/checkout paused/);
 });
 it("verifies checkout applies the policy before creating any payment session",()=>{
  const checkout=readFileSync(resolve(process.cwd(),"src/services/stripeCheckout.ts"),"utf8");
  expect(checkout).toContain("stripe.prices.retrieve(priceId)");
  expect(checkout).toContain("assertAppForgePrice(price, MONTHLY_PLAN_USD_CENTS[tier]");
  expect(checkout).toContain("assertAppForgePrice(price, TOPUP_USD_CENTS[credits]");
  expect(checkout.indexOf("assertAppForgePrice(price, MONTHLY_PLAN_USD_CENTS")).toBeLessThan(checkout.indexOf("stripe.checkout.sessions.create"));
 });
 it("blocks creation and new redemption of unlimited lifetime codes",()=>{
  const admin=readFileSync(resolve(process.cwd(),"src/routers/admin.ts"),"utf8");
  expect(admin).toContain('New unlimited lifetime codes are disabled');
  expect(admin).toContain('Legacy lifetime codes require owner-assisted review');
 });
});
