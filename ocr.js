import { Tensor, InferenceSession } from "onnxruntime-node";
import Jimp from "jimp";
import fs from "fs";
const char = JSON.parse(fs.readFileSync("./ocr_model/char.json"));
const session = await InferenceSession.create("./ocr_model/common.onnx");

export async function classifyImage(src) {
  const inputTensor = await coverImageToTensor(src);
  const {
    output: { data: outputData },
  } = await session.run({ input1: inputTensor });
  let res = [...outputData]
    .filter(Boolean)
    .map((i) => char[Number(i)])
    .join("");
  return res;
}
async function coverImageToTensor(src) {
  // loadImage
  let image = await Jimp.read(src);
  let width = image.bitmap.width;
  let height = image.bitmap.height;
  let dims = [1, 1, 64, Math.floor(width * (64 / height))];
  image = image.invert().resize(dims[3], dims[2]).grayscale();
  // coverImageToTensor
  const redArray = [];
  const greenArray = [];
  const blueArray = [];
  for (let i = 0; i < image.bitmap.data.length; i += 4) {
    if (image.bitmap.data[i + 3]) {
      redArray.push(0);
      greenArray.push(0);
      blueArray.push(0);
    } else {
      redArray.push(255);
      greenArray.push(255);
      blueArray.push(255);
    }
  }

  const transposedData = redArray.concat(greenArray).concat(blueArray);

  const float32Data = new Float32Array(dims.reduce((a, b) => a * b));
  for (let i = 0; i < transposedData.length; i++) {
    float32Data[i] = transposedData[i] / 255.0;
  }

  return new Tensor("float32", float32Data, dims);
}
