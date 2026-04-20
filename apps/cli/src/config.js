import Conf from "conf";

const config = new Conf({ projectName: "lmk" });

if(!config.get("apiUrl")) {
    config.set('apiUrl', 'https://zoological-smile-production-0bc2.up.railway.app/v1');
}

export default config;