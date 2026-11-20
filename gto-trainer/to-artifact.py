# Re-shapes bundle.html into the artifact page format: <title> first, no document wrapper,
# app script after the root element.
import re, sys
src = open("bundle.html", encoding="utf-8").read()
title = re.search(r"<title>.*?</title>", src, re.S).group(0)
links = "".join(re.findall(r"<link[^>]*>", src))
styles = "".join(re.findall(r"<style[^>]*>.*?</style>", src, re.S))
scripts = re.findall(r"<script[^>]*>.*?</script>", src, re.S)
out = (title + '<meta name="claude:viewport-fit-sides" content="cover">' + links + styles
       + '<div id="root"></div>' + "".join(scripts))
open("artifact.html", "w", encoding="utf-8").write(out)
print(len(scripts), "scripts;", round(len(out) / 1024), "KB")
