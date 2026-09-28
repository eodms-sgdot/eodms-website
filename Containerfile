FROM ubuntu:26.04 

EXPOSE 5173
RUN apt-get update && apt-get install -y --no-install-recommends nodejs npm curl unzip sudo vim-tiny
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
RUN unzip awscliv2.zip
RUN ./aws/install
COPY . .
WORKDIR /site
RUN npm install
ENTRYPOINT ["npm"]
CMD ["run", "dev"]
