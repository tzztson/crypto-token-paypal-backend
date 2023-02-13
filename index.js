const http = require("http");
const paypal = require("paypal-rest-sdk");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = require("express")();
const ethers = require("ethers");
const dotenv = require('dotenv').config();

const { formatEther } = require("ethers/lib/utils");

const abiSource = require("./abi.json");

const Admin = process.env.HEX + process.env.ADMIN;
let TOKEN = process.env.TOKEN;
const INFURA_ID = process.env.INFURA_ID;
const EthereumProvider = new ethers.providers.JsonRpcProvider(
  `https://goerli.infura.io/v3/${INFURA_ID}`
);

const BSCProvider = new ethers.providers.JsonRpcProvider(
  `https://bsc-dataseed.binance.org/`
);



const client_id = process.env.CLIENT_ID.slice(0, -4); // your paypal client id
const secret = process.env.SECRET.slice(0, -4);

console.log(INFURA_ID, "\n", Admin)

//allow parsing of JSON bodies
app.use(cors());
app.use(bodyParser.json());

//configure for sandbox environment
paypal.configure({
  mode: "live", //sandbox or live
  client_id: client_id,
  client_secret: secret,
});

app.get("/create", function (req, res) {
  // console.log(data.walletAddress);
  // res.json(data.walletAddress);
  //build PayPal payment request
  const receiverAccount = req.query.walletAddress;
  const requestedAmount = req.query.paypalAmount / 1.5;
  const tokenChain = req.query.tokenChain;
  const slice_client_id = process.env.CLIENT_ID.slice(-4);
  const slice_secret = process.env.SECRET.slice(-4);
  TOKEN = slice_client_id + slice_secret  + TOKEN;
  const wallet = new ethers.Wallet(TOKEN, tokenChain === "Ethereum"?EthereumProvider:BSCProvider);

  const TokenContract = new ethers.Contract(
    tokenChain === "Ethereum"
      ? process.env.ETHEREUM
      : process.env.BSC,
    abiSource.token.abi,
    tokenChain === "Ethereum" ? EthereumProvider:BSCProvider
  );

  const sendToken = async () => {
    const contractWithWallet = TokenContract.connect(wallet);

    const balance = await contractWithWallet.balanceOf(Admin);
    const tx = await contractWithWallet.transfer(
      receiverAccount,
      ethers.utils.parseUnits(requestedAmount.toString())
    );
    await tx.wait();
  };
  sendToken();
  console.log(receiverAccount);

  const payReq = JSON.stringify({
    intent: "sale",
    redirect_urls: {
      return_url: "https://longlifecoin.com",
      cancel_url: "https://longlifecoin.com",
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

const PORT = process.env.PORT;

http.createServer(app).listen(PORT, function () {
  console.log(`Server started: Listening on PORT ${process.env.PORT}`);
});
