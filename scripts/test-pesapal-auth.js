require('dotenv').config();

const { isPesapalConfigured, requestToken, registerIpnUrl } = require('../src/utils/pesapal');

async function main() {
  if (!isPesapalConfigured()) {
    console.error('Set PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET in backend/.env');
    process.exit(1);
  }

  const token = await requestToken();
  console.log('PesaPal auth OK');
  console.log('Token prefix:', `${token.slice(0, 20)}...`);

  try {
    const ipn = await registerIpnUrl();
    console.log('IPN registered:', ipn.ipn_id || ipn);
    if (ipn.ipn_id) {
      console.log(`\nAdd to backend/.env:\nPESAPAL_IPN_ID=${ipn.ipn_id}`);
    }
  } catch (err) {
    console.warn('IPN registration note:', err.message);
  }
}

main().catch((err) => {
  console.error('PesaPal test failed:', err.message);
  process.exit(1);
});
