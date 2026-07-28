import { useEffect } from "react";
import { portfolioMarkup } from "./portfolioMarkup";
import { initPortfolio } from "./portfolioEffects";

export default function App() {
  useEffect(() => {
    initPortfolio();
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: portfolioMarkup }} />;
}
