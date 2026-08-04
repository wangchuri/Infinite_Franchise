export type PutObjectResult = {
  key: string;
  url: string;
};

export type StorageDriver = {
  putObject(
    key: string,
    data: Buffer,
    contentType: string,
  ): Promise<PutObjectResult>;
};
