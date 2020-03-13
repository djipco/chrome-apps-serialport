import { terser } from "rollup-plugin-terser";

export default {

  input: "src/chrome-apps-serialport.js",

  output: [
    {
      format: "es",
      file: "dist/chrome-apps-serialport.js"
    },
    {
      format: "es",
      file: "dist/chrome-apps-serialport.min.js",
      sourcemap: true,
      plugins: [terser()]
    }
  ]

};
