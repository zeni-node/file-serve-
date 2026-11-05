import HomeHeading from "../components/Home/Title/Title.jsx";
import On_Off from "../components/Home/On_Off/On_Off.jsx";
import ConnectedUsers from "../components/Home/ConnectedUsers/ConnectedUsers.jsx";
import Files from "../components/Home/Files/Files.jsx";
import "../components/Home/Home.css";

export default function Home() {
  return (
    <div className="home-modules">
      <HomeHeading />
      <On_Off />
      <Files />
      <ConnectedUsers />
    </div>
  );
}
