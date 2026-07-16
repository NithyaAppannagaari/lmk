import Conf from "conf";

const API_URL = 'https://lmk-api.onrender.com/v1';

const config = new Conf({ projectName: "lmk" });

// Installs from before the Render migration have the retired Railway host saved.
const storedUrl = config.get("apiUrl");
if(!storedUrl || storedUrl.includes('up.railway.app')) {
    config.set('apiUrl', API_URL);
}

export default config;