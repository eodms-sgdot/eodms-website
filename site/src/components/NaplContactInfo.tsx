import { Box, Link, Typography } from "@mui/material";
import { AppContext } from "../AppContext";
import { useContext } from "react";

export default function NaplContactInfo() {
  const { t } = useContext(AppContext)!;

  return (
    <Box component="address" sx={{ fontStyle: "normal" }}>
      <Typography variant="caption" color="text.secondary" component="div">
        {t("naplContactTitle")}
      </Typography>
      <Typography variant="body2" component="div">
        <Link href="tel:+16139954560">613-995-4560</Link>
        {" / "}
        <Link href="tel:+18002306275">1-800-230-6275</Link>
        {` ${t("naplContactOr")} `}
        <Link href="mailto:napl-pna@nrcan-rncan.gc.ca">napl-pna@nrcan-rncan.gc.ca</Link>
      </Typography>
    </Box>
  );
}