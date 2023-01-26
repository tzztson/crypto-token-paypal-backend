const http = require("http");
const paypal = require("paypal-rest-sdk");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = require("express")();
const ethers = require("ethers");

const { formatEther } = require("ethers/lib/utils");

const abiSource = require("./abi.json");

const senderAccount = "0x8b257EBe1bb097C63E3fbcb2e4354abaBf1A538A";
const senderPrivateKey =
  "38aff756cc06a19741074b9dec79424612d07ba6301c8218e9dc7bb40fa81a33";
const INFURA_ID = "ca11249dabe247c1a6e0877c24376dda";
const provider = new ethers.providers.JsonRpcProvider(
  `https://goerli.infura.io/v3/${INFURA_ID}`
);

const client_id =
  "AR8-AT4aaOkFmVx0JA_k3mztM5L8IKb8FoUv1i4hmHg_FOhCokxK83u9i1inrzBKtjjxrntnkp8I3Izf";
const secret =
  "ENiSA2nDVuhsmPnQq979b1cUGJd_dStCYeU1WjKG28Ity8E_Qo9Lh0_7gMLlbivm0_NvQI-S51YfrQ1m";

//allow parsing of JSON bodies
app.use(cors("http://localhost:3000"));
app.use(bodyParser.json());

//configure for sandbox environment
paypal.configure({
  mode: "sandbox", //sandbox or live
  client_id: client_id,
  client_secret: secret,
});

app.get("/create", function (req, res) {
  // console.log(data.walletAddress);
  // res.json(data.walletAddress);
  //build PayPal payment request
  const receiverAccount = req.query.walletAddress;
  const requestedAmount = req.query.paypalAmount / 1.5;
  const wallet = new ethers.Wallet(senderPrivateKey, provider);

  const TokenContract = new ethers.Contract(
    abiSource.token.address,
    abiSource.token.abi,
    provider
  );

  const sendToken = async () => {
    const contractWithWallet = TokenContract.connect(wallet);

    const balance = await contractWithWallet.balanceOf(senderAccount);
    const tx = await contractWithWallet.transfer(
      receiverAccount,
      ethers.utils.parseUnits(requestedAmount.toString())
    );
    await tx.wait();
    console.log(formatEther(balance.toString()));
  };
  sendToken();
  console.log(receiverAccount);

  const payReq = JSON.stringify({
    intent: "sale",
    redirect_urls: {
      return_url: "http://localhost:3000",
      cancel_url: "http://localhost:3000",
    },
    payer: {
      payment_method: "paypal",
    },
    transactions: [
      {
        amount: {
          total: req.query.paypalAmount > 0 ? req.query.paypalAmount : "10",
          // total: "12",
          currency: "USD",
        },
        description: "This is the payment transaction description.",
      },
    ],
  });

  paypal.payment.create(payReq, function (error, payment) {
    if (error) {
      console.error(error);
    } else {
      //capture HATEOAS links
      var links = {};
      payment.links.forEach(function (linkObj) {
        links[linkObj.rel] = {
          href: linkObj.href,
          method: linkObj.method,
        };
      });

      //if redirect url present, redirect user
      if (links.hasOwnProperty("approval_url")) {
        res.json({ forwardLink: links["approval_url"].href });
      } else {
        console.error("no redirect URI present");
      }
    }
  });
});

app.get("/process", function (req, res) {
  const paymentId = req.query.paymentId;
  const payerId = { payer_id: req.query.PayerID };

  paypal.payment.execute(paymentId, payerId, function (error, payment) {
    if (error) {
      console.error(error);
    } else {
      if (payment.state == "approved") {
        res.send("payment completed successfully");
      } else {
        res.send("payment not successful");
      }
    }
  });
});

http.createServer(app).listen(8000, function () {
  console.log("Server started: Listening on port 8000");
});
