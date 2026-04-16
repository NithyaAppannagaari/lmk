import Conf from "conf";

const config = new Conf({ projectName: "lmk" });

if(!config.get("apiUrl")) {
    config.set('apiUrl', 'http://localhost:8000/v1');
}

export default config;