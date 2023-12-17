const { GraphQLError } = require("graphql");
const User = require("../models/user");
const { emailFormat, passwordValidation } = require("../helpers/validation");
const { hashPassword, comparePassword } = require("../helpers/bcryptjs");
const { signToken } = require("../helpers/jwt");
const { OAuth2Client } = require('google-auth-library');
const Post = require("../models/post");
const { getCity } = require("../helpers/gmapsapi");
const { chatAI } = require("../helpers/openai");
const client = new OAuth2Client();

const typeDefs = `#graphql
  type Post {
    _id: ID
    name: String
    size: String
    age: String
    breed: String
    gender: String
    color: String
    description: String
    long: Float
    lat: Float
    AdopterId: ID
    PosterId: ID
    InformationId: ID
    status: String
    statusPrice: String
    photo: [String]
    createdAt: String
    updatedAt: String
  }

  type Query {
    postsByRadius(breed: String, long: Float, lat: Float) : [Post]
    postsById(PostId: String): Post
    postsByPosterId(PosterId: String): [Post]
    postsByAdopterId(AdopterId: String): [Post]
  }

  type UpdateAdopterRes {
    message: String
    code: String
  }

  type DeletePostRes {
    message: String
    code: String
  }
  type PostResponse {
    message: String
    code: String
  }

  type Mutation {
    addPost(
      name: String
      size: String
      age: String
      breed: String
      gender: String
      color: String
      description: String
      statusPrice: String
      photo: [String]
      long: Float
      lat: Float
    ): PostResponse

    UpdateAdopter(
        AdopterId: ID
        PostId: ID
    ): UpdateAdopterRes
    
    DeletePost(
        PostId: ID
    ): DeletePostRes

    editPost(
      PostId: String
      name: String
      size: String
      age: String
      breed: String
      gender: String
      color: String
      description: String
      status: String
      statusPrice: String
      AdopterId: ID
      PosterId: ID
      photo: [String]
      long: Float
      lat: Float
    ): Post
  }
`;

const resolvers = {
  Query: {
    postsByRadius: async (_, { long, lat, breed }, { authentication }) => {
      try {
        const { userId } = await authentication();
        const currentCity = await getCity(long, lat);
        await User.patchCurrentLoc({ currentLoc: currentCity, userId });

        const posts = await Post.getByRadius({ lat, long, breed });
        return posts;
      } catch (err) {
        throw err;
      }
    },

    postsById: async (_, { PostId }, { authentication }) => {
      try {
        const { UserId } = await authentication();
        const post = await Post.getById({ PostId });
        return post;
      } catch (err) {
        throw err;
      }
    },

    postsByPosterId: async (_, { PosterId }, { authentication }) => {
      try {
        await authentication();
        const posts = await Post.getByPosterId({ PosterId });
        return posts;
      } catch (err) {
        throw err;
      }
    },

    postsByAdopterId: async (_, { AdopterId }, { authentication }) => {
      try {
        await authentication();
        const posts = await Post.getByAdopterId({ AdopterId });
        return posts;
      } catch (err) {
        throw err;
      }
    },
  },

  Mutation: {
    UpdateAdopter: async (_, { AdopterId, PostId }, { authentication }) => {
      try {
        await authentication();
        const update = await Post.updateAdopter({ AdopterId, PostId });

        if (update.matchedCount === 0) {
          throw new GraphQLError('Post/Adopter`s data is not found', {
            extensions: { message: "Post/Adopter`s data is not found", code: 'Not Found' },
          });
        };

        return { message: "successfully change status", code: "Success" };
      } catch (error) {
        throw error;
      }
    },


    addPost: async (_, args, { authentication }) => {
      const { UserId } = await authentication();
      try {
        const { name, size, age, breed, gender, color, description, statusPrice, photo, long, lat } = args

        if (!name) {
          throw new GraphQLError("Name is required", {
            extensions: { code: "Bad Request" }
          })
        }

        if (!size) {
          throw new GraphQLError("Size is required", {
            extensions: { code: "Bad Request" }
          })
        }

        if (!breed) {
          throw new GraphQLError("Breed is required", {
            extensions: { code: "Bad Request" }
          })
        }

        if (!age) {
          throw new GraphQLError("Age is required", {
            extensions: { code: "Bad Request" }
          })
        }

        if (!gender) {
          throw new GraphQLError("Gender is required", {
            extensions: { code: "Bad Request" }
          })
        }

        if (!color) {
          throw new GraphQLError("Color is required", {
            extensions: { code: "Bad Request" }
          })
        }

        if (!long || !lat) {
          throw new GraphQLError("Location is required", {
            extensions: { code: "Bad Request" }
          })
        }

        if (!statusPrice) {
          throw new GraphQLError("Please select a price status", {
            extensions: { code: "Bad Request" }
          })
        }

        if (!photo.length) {
          throw new GraphQLError("Image is required", {
            extensions: { code: "Bad Request" }
          })
        }


        const question = `
        saya mempunyai ras ${breed} berikan saya informasi terkait pemeliharaannya seperti:
        makanan,  kesehatan, kebersihan, aktivitas, tempat beristirahat
        berikan dalam format json dengan format seperti di bawah ini:

          {
           
              "makanan": {
                "deskripsi": "Beri makanan kucing berkualitas dengan kandungan nutrisi yang sesuai.",
                "emoji": "🍽️"
              },
              "kesehatan": {
                "deskripsi": "Lakukan kunjungan rutin ke dokter hewan, berikan vaksinasi, dan perhatikan tanda-tanda kesehatan.",
                "emoji": "👩‍⚕️"
              },
              "kebersihan": {
                "deskripsi": "Sediakan kotak pasir bersih, lakukan pembersihan rutin, dan perhatikan kebersihan bulu.",
                "emoji": "🚿"
              },
              "aktivitas": {
                "deskripsi": "Stimulasi aktivitas fisik dan mental dengan mainan dan interaksi yang berkualitas.",
                "emoji": "🎾"
              },
              "tempat_beristirahat": {
                "deskripsi": "Sediakan tempat tidur yang nyaman dan tenang untuk istirahat kucing.",
                "emoji": "😴"
              }
            
          }


        berikan juga emoji yang mewakili setiap informasinya dan berikan deskripsi yang lebih lengkap dan informatif. cukup berikan jsonnya saja tidak perlu ada respons deskripsi apa pun selain respons dalam bentuk json
        `;
        const questions = await chatAI(question);
        const information = JSON.parse(questions);
        const newPost = await Post.create(name, size, age, breed, gender, color, description, information, photo, long, lat, UserId, statusPrice)
        return { message: `successfully add post with cat's name : ${newPost.name}`, code: "Success" };
      } catch (err) {
        throw err
      }
    },

    DeletePost: async (_, { PostId }, { authentication }) => {
      try {
        await authentication();

        const post = await Post.getById({ PostId });
        if (post.status !== 'available') {
          throw new GraphQLError('Cat has been already adopted', {
            extensions: { message: "Cat has been already adopted", code: 'Bad Request' },
          });
        }

        const deletePost = await Post.delete({ PostId });
        if (deletePost.deletedCount === 0) {
          throw new GraphQLError('Post Id is not found', {
            extensions: { message: "Post is not found", code: 'Not Found' },
          });
        };

        return { message: "successfully delete post", code: "Success" };
      } catch (err) {
        throw err;
      }
    },
    
    editPost: async (_, args, { authentication }) => {
      await authentication()

      try {
        const { PostId, name, size, age, breed, gender, color, description, statusPrice, photo, long, lat } = args
        const editPost = await Post.edit(PostId, name, size, age, breed, gender, color, description, statusPrice, photo, long, lat)
        return editPost

      } catch(err) {
        throw err
      }
    }
  }
}

module.exports = { typeDefs, resolvers }