# Use official Node.js image
FROM node:18 as base

WORKDIR /usr/src/app

# install dependencies into temp directory (cache for faster rebuilds)
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json package-lock.json /temp/dev/
RUN cd /temp/dev && npm ci

# install only production dependencies
RUN mkdir -p /temp/prod
COPY package.json package-lock.json /temp/prod/
RUN cd /temp/prod && npm ci --only=production

# copy node_modules from temp directory
# then copy all project files into image
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

# copy production dependencies and source code into final image
FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/app/bm_pirateban.js .
COPY --from=prerelease /usr/src/app/package.json .

# run the app as node user inside container
USER node
ENTRYPOINT [ "node", "bm_pirateban.js" ]
