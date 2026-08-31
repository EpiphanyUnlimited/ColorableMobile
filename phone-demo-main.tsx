import { createRoot } from "react-dom/client";
import "./styles/globals.css";
import Default from "./phone-demo";

const container = document.getElementById("root");
const root = createRoot(container!);
root.render(<Default />);
